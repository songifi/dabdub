import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ConfigType } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as PDFDocument from 'pdfkit';
import { r2Config } from '../config/r2.config';
import { Transaction, TransactionType } from '../transactions/entities/transaction.entity';
import { PayLink, PayLinkStatus } from '../paylink/entities/pay-link.entity';
import { User } from '../users/entities/user.entity';
import { Merchant } from '../merchants/entities/merchant.entity';
import { EmailService } from '../email/email.service';

const RECEIPT_EXPIRY_SECONDS = 3600;
const BRAND_COLOR = '#F5A623';
const BRAND_DARK = '#1A1A2E';

function typeLabel(type: TransactionType): string {
  const map: Record<TransactionType, string> = {
    [TransactionType.DEPOSIT]: 'Deposit',
    [TransactionType.WITHDRAWAL]: 'Withdrawal',
    [TransactionType.TRANSFER_IN]: 'Received',
    [TransactionType.TRANSFER_OUT]: 'Sent',
    [TransactionType.PAYLINK_RECEIVED]: 'Received',
    [TransactionType.PAYLINK_SENT]: 'Sent',
    [TransactionType.STAKE]: 'Stake',
    [TransactionType.UNSTAKE]: 'Unstake',
    [TransactionType.YIELD_CREDIT]: 'Yield Credit',
    [TransactionType.VIRTUAL_CARD_CREATION]: 'Card Creation',
    [TransactionType.VIRTUAL_CARD_FUND]: 'Card Fund',
    [TransactionType.VIRTUAL_CARD_SPEND]: 'Card Spend',
  };
  return map[type] ?? type;
}

function watTime(date: Date): string {
  return date.toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

@Injectable()
export class ReceiptService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(PayLink)
    private readonly payLinkRepo: Repository<PayLink>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    @Inject(r2Config.KEY)
    private readonly cfg: ConfigType<typeof r2Config>,
    private readonly emailService: EmailService,
  ) {
    this.bucket = cfg.bucketName;
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async generateTransactionReceipt(
    txId: string,
    userId: string,
    forceRefresh = false,
  ): Promise<{ receiptUrl: string; expiresAt: Date }> {
    const tx = await this.txRepo.findOne({ where: { id: txId } });
    if (!tx) throw new NotFoundException(`Transaction ${txId} not found`);
    if (tx.userId !== userId) throw new ForbiddenException();

    const key = `receipts/${userId}/${txId}.pdf`;
    return this.getOrGenerate(key, forceRefresh, () =>
      this.buildTransactionPdf(tx),
    );
  }

  async generatePayLinkReceipt(
    tokenId: string,
    userId: string,
    forceRefresh = false,
  ): Promise<{ receiptUrl: string; expiresAt: Date }> {
    const pl = await this.payLinkRepo.findOne({ where: { tokenId } });
    if (!pl) throw new NotFoundException(`PayLink ${tokenId} not found`);
    if (pl.creatorUserId !== userId && pl.paidByUserId !== userId) {
      throw new ForbiddenException();
    }
    if (pl.status !== PayLinkStatus.PAID) {
      throw new ForbiddenException('Receipt only available for paid PayLinks');
    }

    const key = `receipts/paylinks/${tokenId}.pdf`;
    return this.getOrGenerate(key, forceRefresh, () =>
      this.buildPayLinkPdf(pl),
    );
  }

  async emailTransactionReceipt(txId: string, userId: string): Promise<void> {
    const { receiptUrl } = await this.generateTransactionReceipt(txId, userId);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.emailService.queue(
      user.email,
      'transaction-receipt',
      { receiptUrl, txId: txId.slice(-8).toUpperCase(), displayName: user.displayName ?? user.username },
      userId,
    );
  }

  // ── Admin: no ownership check ───────────────────────────────────────────────

  async generateTransactionReceiptAdmin(
    txId: string,
  ): Promise<{ receiptUrl: string; expiresAt: Date }> {
    const tx = await this.txRepo.findOne({ where: { id: txId } });
    if (!tx) throw new NotFoundException(`Transaction ${txId} not found`);
    const key = `receipts/${tx.userId}/${txId}.pdf`;
    return this.getOrGenerate(key, false, () => this.buildTransactionPdf(tx));
  }

  // ── Core helpers ────────────────────────────────────────────────────────────

  private async getOrGenerate(
    key: string,
    forceRefresh: boolean,
    build: () => Promise<Buffer>,
  ): Promise<{ receiptUrl: string; expiresAt: Date }> {
    if (!forceRefresh && (await this.exists(key))) {
      return this.presign(key);
    }

    const pdf = await build();
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: pdf,
        ContentType: 'application/pdf',
      }),
    );
    return this.presign(key);
  }

  private async exists(key: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  private async presign(key: string): Promise<{ receiptUrl: string; expiresAt: Date }> {
    const receiptUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: RECEIPT_EXPIRY_SECONDS },
    );
    const expiresAt = new Date(Date.now() + RECEIPT_EXPIRY_SECONDS * 1000);
    return { receiptUrl, expiresAt };
  }

  // ── PDF builders ────────────────────────────────────────────────────────────

  private buildTransactionPdf(tx: Transaction): Promise<Buffer> {
    const counterparty = tx.counterpartyUsername ?? '—';
    const txHash = tx.reference ? tx.reference.slice(-8).toUpperCase() : '—';
    const ngnEquiv = tx.amount ? `₦${Number(tx.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}` : '—';

    return this.renderPdf((doc) => {
      this.addHeader(doc);
      this.addField(doc, 'Transaction ID', tx.id.slice(-8).toUpperCase());
      this.addField(doc, 'Date / Time', watTime(tx.createdAt));
      this.addField(doc, 'Type', typeLabel(tx.type));
      this.addField(doc, 'Amount (USDC)', `${tx.amountUsdc} USDC`);
      this.addField(doc, 'Amount (NGN)', ngnEquiv);
      this.addField(doc, 'Fee', tx.fee ?? '0 USDC');
      this.addField(doc, 'Counterparty', counterparty);
      this.addField(doc, 'Tx Hash', txHash);
      this.addStatusBadge(doc, tx.status);
      this.addFooter(doc);
    });
  }

  private async buildPayLinkPdf(pl: PayLink): Promise<Buffer> {
    const merchant = await this.merchantRepo.findOne({ where: { userId: pl.creatorUserId } });
    const creator = await this.userRepo.findOne({ where: { id: pl.creatorUserId } });

    return this.renderPdf((doc) => {
      this.addHeader(doc);
      this.addField(doc, 'PayLink ID', pl.tokenId.slice(-8).toUpperCase());
      this.addField(doc, 'Date / Time', watTime(pl.updatedAt ?? pl.createdAt));
      this.addField(doc, 'Type', 'PayLink Payment');
      this.addField(doc, 'Amount (USDC)', `${pl.amount} USDC`);
      this.addField(doc, 'Note', pl.note ?? '—');
      this.addField(doc, 'Creator', creator?.username ?? '—');
      if (merchant) this.addField(doc, 'Business', merchant.businessName);
      this.addField(doc, 'Tx Hash', (pl.paymentTxHash ?? '').slice(-8).toUpperCase() || '—');
      this.addStatusBadge(doc, 'completed');
      this.addFooter(doc);
    });
  }

  private renderPdf(populate: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new (PDFDocument as any)({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      populate(doc);
      doc.end();
    });
  }

  private addHeader(doc: PDFKit.PDFDocument): void {
    doc.rect(0, 0, doc.page.width, 70).fill(BRAND_DARK);
    doc.fillColor(BRAND_COLOR).fontSize(22).font('Helvetica-Bold').text('Cheese Pay', 50, 22);
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica').text('Payment Receipt', 50, 48);
    doc.moveDown(3);
    doc.fillColor(BRAND_DARK);
  }

  private addField(doc: PDFKit.PDFDocument, label: string, value: string): void {
    doc.fontSize(9).fillColor('#888888').font('Helvetica').text(label.toUpperCase(), { continued: false });
    doc.fontSize(11).fillColor(BRAND_DARK).font('Helvetica-Bold').text(value);
    doc.moveDown(0.5);
  }

  private addStatusBadge(doc: PDFKit.PDFDocument, status: string): void {
    const color = status === 'completed' ? '#27AE60' : status === 'failed' ? '#E74C3C' : '#F39C12';
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(color).font('Helvetica-Bold').text(`● ${status.toUpperCase()}`);
    doc.moveDown(0.5);
  }

  private addFooter(doc: PDFKit.PDFDocument): void {
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#aaaaaa').font('Helvetica')
      .text('cheesepay.xyz — Seamless crypto payments, instant fiat settlements', { align: 'center' });
  }
}
