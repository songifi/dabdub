import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Merchant, MerchantStatus } from '../merchants/entities/merchant.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { AuthTokenResponseDto } from './dto/auth-token-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Merchant)
    private merchantsRepo: Repository<Merchant>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokenResponseDto> {
    const existing = await this.merchantsRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const merchant = this.merchantsRepo.create({
      email: dto.email,
      passwordHash,
      businessName: dto.businessName,
      businessType: dto.businessType,
      country: dto.country,
      status: MerchantStatus.ACTIVE,
    });

    const saved = await this.merchantsRepo.save(merchant);
    const token = this.signToken(saved.id, saved.email, saved.role);

    return { accessToken: token, merchant: saved };
  }

  async login(dto: LoginDto): Promise<AuthTokenResponseDto> {
    const merchant = await this.merchantsRepo.findOne({ where: { email: dto.email } });
    if (!merchant) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, merchant.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.signToken(merchant.id, merchant.email, merchant.role);
    return { accessToken: token, merchant };
  }

  async findMerchantByApiKey(rawKey: string): Promise<Merchant | null> {
    const merchants = await this.merchantsRepo.find({
      where: { apiKeyHash: Not(IsNull()) },
    });
    for (const m of merchants) {
      if (m.apiKeyHash && (await bcrypt.compare(rawKey, m.apiKeyHash))) {
        return m;
      }
    }
    return null;
  }

  private signToken(sub: string, email: string, role?: string): string {
    return this.jwtService.sign({ sub, email, role });
  }
}
