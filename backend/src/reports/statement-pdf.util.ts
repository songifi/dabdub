import * as PDFDocument from 'pdfkit';
import { Transaction, TransactionType } from '../transactions/entities/transaction.entity';

interface StatementUser {
  displayName: string | null;
  username: string;
  tier: string;
}

export interface StatementComputation {
  openingBalance: number;
  closingBalance: number;
  totalIn: number;
  totalOut: number;
  feesPaid: number;
  rows: Array<{
    createdAt: Date;
    type: string;
    reference: string | null;
    amountSigned: number;
    fee: number;
    runningBalance: number;
    status: string;
  }>;
}

const INCOMING_TYPES = new Set<TransactionType>([
  TransactionType.DEPOSIT,
  TransactionType.TRANSFER_IN,
  TransactionType.PAYLINK_RECEIVED,
  TransactionType.UNSTAKE,
  TransactionType.YIELD_CREDIT,
]);

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function signedAmount(tx: Transaction): number {
  const amount = toNumber(tx.amountUsdc ?? tx.amount);
  return INCOMING_TYPES.has(tx.type) ? amount : -amount;
}

export function computeStatement(transactions: Transaction[]): StatementComputation {
  const sorted = [...transactions].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  if (sorted.length === 0) {
    return {
      openingBalance: 0,
      closingBalance: 0,
      totalIn: 0,
      totalOut: 0,
      feesPaid: 0,
      rows: [],
    };
  }

  const first = sorted[0]!;
  const openingBalance = toNumber(first.balanceAfter) - signedAmount(first);

  let totalIn = 0;
  let totalOut = 0;
  let feesPaid = 0;

  const rows = sorted.map((tx) => {
    const amountSigned = signedAmount(tx);
    if (amountSigned >= 0) {
      totalIn += amountSigned;
    } else {
      totalOut += Math.abs(amountSigned);
    }

    const fee = toNumber(tx.fee);
    feesPaid += fee;

    return {
      createdAt: tx.createdAt,
      type: tx.type,
      reference: tx.reference,
      amountSigned,
      fee,
      runningBalance: toNumber(tx.balanceAfter),
      status: tx.status,
    };
  });

  const closingBalance = rows[rows.length - 1]!.runningBalance;

  return {
    openingBalance,
    closingBalance,
    totalIn,
    totalOut,
    feesPaid,
    rows,
  };
}

export async function generateAccountStatementPdf(params: {
  user: StatementUser;
  dateFrom: string;
  dateTo: string;
  transactions: Transaction[];
}): Promise<Buffer> {
  const summary = computeStatement(params.transactions);

  return new Promise((resolve, reject) => {
    const doc = new (PDFDocument as any)({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    let page = 1;

    const addHeader = (): void => {
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#0B3D2E').text('Cheese Account Statement');
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(10).fillColor('#1A1A1A').text(
        `Account: ${params.user.displayName ?? params.user.username} (@${params.user.username})`,
      );
      doc.text(`Tier: ${params.user.tier}`);
      doc.text(`Date Range: ${params.dateFrom} to ${params.dateTo}`);
      doc.text(`Generated At: ${new Date().toISOString()}`);
      doc.moveDown(0.8);
    };

    const addFooter = (): void => {
      doc.font('Helvetica').fontSize(9).fillColor('#666666');
      doc.text(`Page ${page}`, 40, 800, { align: 'right', width: 520 });
    };

    const ensureSpace = (height: number): void => {
      if (doc.y + height <= 760) {
        return;
      }
      addFooter();
      doc.addPage();
      page += 1;
      addHeader();
    };

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    addHeader();

    doc.font('Helvetica-Bold').fontSize(11).text('Summary');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Opening Balance: ${summary.openingBalance.toFixed(6)} USDC`);
    doc.text(`Closing Balance: ${summary.closingBalance.toFixed(6)} USDC`);
    doc.text(`Total In: ${summary.totalIn.toFixed(6)} USDC`);
    doc.text(`Total Out: ${summary.totalOut.toFixed(6)} USDC`);
    doc.text(`Fees Paid: ${summary.feesPaid.toFixed(6)} USDC`);
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(11).text('Transactions');
    doc.moveDown(0.4);

    if (summary.rows.length === 0) {
      doc.font('Helvetica').fontSize(10).text('No transactions in this period.');
    } else {
      doc.font('Helvetica-Bold').fontSize(9).text(
        'Date                 Type                  Reference                Amount        Fee      Running Bal.   Status',
      );
      doc.moveDown(0.2);

      for (const row of summary.rows) {
        ensureSpace(16);
        const date = row.createdAt.toISOString().slice(0, 10);
        const type = row.type.slice(0, 20).padEnd(20, ' ');
        const ref = (row.reference ?? '-').slice(0, 22).padEnd(22, ' ');
        const amount = `${row.amountSigned >= 0 ? '+' : ''}${row.amountSigned.toFixed(2)}`.padStart(8, ' ');
        const fee = row.fee.toFixed(2).padStart(8, ' ');
        const bal = row.runningBalance.toFixed(2).padStart(10, ' ');
        doc.font('Helvetica').fontSize(8.5).text(
          `${date}   ${type}   ${ref}   ${amount}   ${fee}   ${bal}   ${row.status}`,
        );
      }
    }

    ensureSpace(60);
    doc.moveDown(1);
    doc.font('Helvetica').fontSize(10).text('Digital Signature', { underline: false });
    doc.moveTo(40, doc.y + 6).lineTo(260, doc.y + 6).strokeColor('#111111').stroke();

    addFooter();
    doc.end();
  });
}
