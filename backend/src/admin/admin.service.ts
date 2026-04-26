import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Merchant, MerchantStatus, MerchantRole } from '../merchants/entities/merchant.entity';
import { Payment } from '../payments/entities/payment.entity';
import { FeeConfig, FeeType } from '../fee-config/entities/fee-config.entity';
import { FeeHistory, FeeChangeType } from '../fee-config/entities/fee-history.entity';
import { AuditLog } from './entities/audit-log.entity';
import { FilterService } from '../common/filter.service';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Merchant)
    private merchantsRepo: Repository<Merchant>,
    @InjectRepository(Payment)
    private paymentsRepo: Repository<Payment>,
    @InjectRepository(FeeConfig)
    private readonly feeConfigRepo: Repository<FeeConfig>,
    @InjectRepository(FeeHistory)
    private readonly feeHistoryRepo: Repository<FeeHistory>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly filterService: FilterService,
  ) {}

  async findAllMerchants(page = 1, limit = 20) {
    const [merchants, total] = await this.merchantsRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      withDeleted: true,
    });
    return { merchants: merchants.map(m => this.sanitize(m)), total };
  }

  async findOneMerchant(id: string) {
    const merchant = await this.merchantsRepo.findOne({ where: { id }, withDeleted: true });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return this.sanitize(merchant);
  }

  async updateMerchantStatus(id: string, status: MerchantStatus) {
    const merchant = await this.merchantsRepo.findOne({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');

    merchant.status = status;
    await this.merchantsRepo.save(merchant);
    return this.sanitize(merchant);
  }

  async bulkUpdateMerchantStatus(ids: string[], status: MerchantStatus) {
    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    for (const id of ids) {
      try {
        await this.updateMerchantStatus(id, status);
        results.success.push(id);
      } catch (error) {
        results.failed.push({ id, error: error.message });
      }
    }

    return results;
  }

  async getGlobalStats() {
    const stats = await this.paymentsRepo
      .createQueryBuilder('payment')
      .select('payment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(payment.amountUsd)', 'totalUsd')
      .groupBy('payment.status')
      .getRawMany();

    const merchantStats = await this.merchantsRepo
      .createQueryBuilder('merchant')
      .select('merchant.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('merchant.status')
      .getRawMany();

    return {
      payments: stats,
      merchants: merchantStats,
    };
  }

  private sanitize(merchant: Merchant) {
    const { passwordHash, apiKeyHash, ...rest } = merchant as any;
    return rest;
  }

  // ── Fee Management ─────────────────────────────────────────────────────────

  async getGlobalFees(): Promise<FeeConfig[]> {
    return this.feeConfigRepo.find({ order: { feeType: 'ASC' } });
  }

  async updateGlobalFee(
    feeType: FeeType,
    newRate: string,
    adminId: string,
    reason?: string,
  ): Promise<FeeConfig> {
    const feeConfig = await this.feeConfigRepo.findOne({ where: { feeType } });
    if (!feeConfig) {
      throw new NotFoundException(`Fee config for ${feeType} not found`);
    }

    const previousValue = feeConfig.baseFeeRate;
    feeConfig.baseFeeRate = newRate;
    const updated = await this.feeConfigRepo.save(feeConfig);

    await this.recordFeeHistory({
      feeType,
      changeType: FeeChangeType.GLOBAL,
      merchantId: null,
      previousValue,
      newValue: newRate,
      actorId: adminId,
      reason: reason ?? null,
    });

    return updated;
  }

  async recordFeeHistory(dto: {
    feeType: string;
    changeType: FeeChangeType;
    merchantId: string | null;
    previousValue: string;
    newValue: string;
    actorId: string;
    reason: string | null;
  }): Promise<FeeHistory> {
    const entry = this.feeHistoryRepo.create(dto);
    return this.feeHistoryRepo.save(entry);
  }

  // ── Geographic Distribution Analytics (#714) ───────────────────────────────

  async getGeographicDistribution(sortBy = 'volume') {
    const rows = await this.paymentsRepo
      .createQueryBuilder('payment')
      .innerJoin('payment.merchant', 'merchant')
      .select('merchant.country', 'countryCode')
      .addSelect('COUNT(DISTINCT merchant.id)', 'merchantCount')
      .addSelect('COUNT(payment.id)', 'paymentCount')
      .addSelect('COALESCE(SUM(payment.amountUsd), 0)', 'volumeUsd')
      .groupBy('merchant.country')
      .limit(50)
      .getRawMany();

    const sortFn: Record<string, (a: any, b: any) => number> = {
      volume: (a, b) => parseFloat(b.volumeUsd) - parseFloat(a.volumeUsd),
      merchantCount: (a, b) => parseInt(b.merchantCount, 10) - parseInt(a.merchantCount, 10),
      paymentCount: (a, b) => parseInt(b.paymentCount, 10) - parseInt(a.paymentCount, 10),
    };

    const comparator = sortFn[sortBy] ?? sortFn['volume'];
    rows.sort(comparator);

    return rows.map(r => ({
      countryCode: r.countryCode,
      merchantCount: parseInt(r.merchantCount, 10),
      paymentCount: parseInt(r.paymentCount, 10),
      volumeUsd: parseFloat(r.volumeUsd),
    }));
  }

  // ── Admin User Management with 2FA (#707) ──────────────────────────────────

  async createAdmin(
    email: string,
    password: string,
    businessName: string,
    actorRole: MerchantRole,
  ) {
    if (actorRole !== MerchantRole.SUPERADMIN) {
      throw new ForbiddenException('Only SUPERADMIN can create admin users');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const merchant = this.merchantsRepo.create({
      email,
      passwordHash,
      businessName,
      role: MerchantRole.ADMIN,
      status: MerchantStatus.ACTIVE,
    });
    const saved = await this.merchantsRepo.save(merchant);
    console.log(`[AdminService] Admin user created: ${saved.id} (${email})`);
    return this.sanitize(saved);
  }

  async deleteAdmin(id: string, actorRole: MerchantRole) {
    if (actorRole !== MerchantRole.SUPERADMIN) {
      throw new ForbiddenException('Only SUPERADMIN can delete admin users');
    }
    const merchant = await this.merchantsRepo.findOne({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    if (merchant.role !== MerchantRole.ADMIN) {
      throw new BadRequestException('Target user is not an ADMIN');
    }
    await this.merchantsRepo.remove(merchant);
    return { deleted: true, id };
  }

  async setupAdminTotp(id: string) {
    const merchant = await this.merchantsRepo.findOne({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');

    const secretBytes = crypto.randomBytes(20);
    const secret = this.base32Encode(secretBytes);
    merchant.totpSecret = secret;
    await this.merchantsRepo.save(merchant);

    const otpauthUri = `otpauth://totp/CheesePay:${merchant.email}?secret=${secret}&issuer=CheesePay`;
    return { secret, otpauthUri };
  }

  async verifyAdminTotp(id: string, token: string) {
    const merchant = await this.merchantsRepo.findOne({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    if (!merchant.totpSecret) {
      throw new BadRequestException('TOTP has not been set up for this user');
    }

    const success = this.verifyTotpToken(merchant.totpSecret, token);
    if (success) {
      merchant.totpEnabled = true;
      await this.merchantsRepo.save(merchant);
    }
    return { success };
  }

  async updateAdminAllowedIps(id: string, ips: string[]) {
    const merchant = await this.merchantsRepo.findOne({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    merchant.allowedIps = ips.length > 0 ? ips.join(',') : null;
    await this.merchantsRepo.save(merchant);
    return this.sanitize(merchant);
  }

  // ── Sandbox Environment Management (#708) ──────────────────────────────────

  async toggleSandboxMode(id: string, enabled: boolean) {
    const merchant = await this.merchantsRepo.findOne({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    merchant.sandboxMode = enabled;
    await this.merchantsRepo.save(merchant);
    return this.sanitize(merchant);
  }

  async resetSandboxData(merchantId: string) {
    const merchant = await this.merchantsRepo.findOne({ where: { id: merchantId } });
    if (!merchant) throw new NotFoundException('Merchant not found');

    const payments = await this.paymentsRepo.find({ where: { merchantId } });
    await this.paymentsRepo.remove(payments);
    return { deleted: payments.length };
  }

  // ── Audit Log Viewer ───────────────────────────────────────────────────────

  async getAuditLogs(
    query: Record<string, any>,
    pagination: PaginationDto,
    exportCsv = false,
  ): Promise<PaginatedResponseDto<AuditLog> | string> {
    const allowedFields = ['actor', 'action', 'resourceType', 'createdAt'];
    const where = this.filterService.buildWhereConditions(query, allowedFields);

    if (exportCsv) {
      const data = await this.auditLogRepo.find({
        where,
        order: { createdAt: 'DESC' },
      });
      return this.toCsv(data);
    }

    const [data, total] = await this.auditLogRepo.findAndCount({
      where,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      order: { createdAt: 'DESC' },
    });

    return PaginatedResponseDto.of(data, total, pagination.page, pagination.limit);
  }

  private toCsv(data: AuditLog[]): string {
    if (data.length === 0) return 'id,actor,action,resourceType,resourceId,details,createdAt\n';

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(val => 
        typeof val === 'object' ? JSON.stringify(val) : val
      ).join(',')
    );
    return [headers, ...rows].join('\n');
  }

  // ── TOTP helpers ───────────────────────────────────────────────────────────

  private base32Encode(buf: Buffer): string {
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let val = 0;
    let out = '';
    for (const byte of buf) {
      val = (val << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        out += alpha[(val >>> (bits - 5)) & 0x1f];
        bits -= 5;
      }
    }
    if (bits > 0) {
      out += alpha[(val << (5 - bits)) & 0x1f];
    }
    return out;
  }

  private base32Decode(str: string): Buffer {
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0, val = 0;
    const out: number[] = [];
    for (const c of str.toUpperCase().replace(/=+$/, '')) {
      const idx = alpha.indexOf(c);
      if (idx < 0) continue;
      val = (val << 5) | idx;
      bits += 5;
      if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
    }
    return Buffer.from(out);
  }

  private totpCode(secret: string, time = Math.floor(Date.now() / 1000)): string {
    const counter = Math.floor(time / 30);
    const buf = Buffer.alloc(8);
    buf.writeUInt32BE(0, 0);
    buf.writeUInt32BE(counter >>> 0, 4);
    const hmac = require('crypto').createHmac('sha1', this.base32Decode(secret)).update(buf).digest();
    const offset = hmac[19] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 1_000_000;
    return String(code).padStart(6, '0');
  }

  private verifyTotpToken(secret: string, token: string): boolean {
    const t = Math.floor(Date.now() / 1000);
    return [-1, 0, 1].some(w => this.totpCode(secret, t + w * 30) === token);
  }

  // ── Generic Record Management (#soft-delete) ───────────────────────────────

  async restoreRecord(entity: string, id: string) {
    if (entity === 'merchants') {
      const record = await this.merchantsRepo.findOne({ where: { id }, withDeleted: true });
      if (!record) throw new NotFoundException('Merchant not found');
      if (!record.deletedAt) throw new BadRequestException('Merchant is not deleted');
      await this.merchantsRepo.restore(id);
      return { success: true, id };
    } else if (entity === 'payments') {
      const record = await this.paymentsRepo.findOne({ where: { id }, withDeleted: true });
      if (!record) throw new NotFoundException('Payment not found');
      if (!record.deletedAt) throw new BadRequestException('Payment is not deleted');
      await this.paymentsRepo.restore(id);
      return { success: true, id };
    } else {
      throw new BadRequestException('Invalid entity type');
    }
  }

  async deleteRecord(entity: string, id: string, hard: boolean, actorRole: MerchantRole) {
    if (hard && actorRole !== MerchantRole.SUPERADMIN) {
      throw new ForbiddenException('Only SUPERADMIN can hard delete records');
    }

    if (entity === 'merchants') {
      const record = await this.merchantsRepo.findOne({ where: { id }, withDeleted: true });
      if (!record) throw new NotFoundException('Merchant not found');
      
      if (hard) {
        await this.merchantsRepo.delete(id);
      } else {
        await this.merchantsRepo.softDelete(id);
      }
      return { success: true, id, hardDeleted: hard };
    } else if (entity === 'payments') {
      const record = await this.paymentsRepo.findOne({ where: { id }, withDeleted: true });
      if (!record) throw new NotFoundException('Payment not found');
      
      if (hard) {
        await this.paymentsRepo.delete(id);
      } else {
        await this.paymentsRepo.softDelete(id);
      }
      return { success: true, id, hardDeleted: hard };
    } else {
      throw new BadRequestException('Invalid entity type');
    }
  }
}

