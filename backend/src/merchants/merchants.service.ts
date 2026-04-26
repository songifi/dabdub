import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { Merchant } from "./entities/merchant.entity";
import { UpdateMerchantDto } from "./dto/create-merchant.dto";

@Injectable()
export class MerchantsService {
  constructor(
    @InjectRepository(Merchant)
    private merchantsRepo: Repository<Merchant>,
  ) {}

  async findOne(id: string): Promise<Merchant> {
    const merchant = await this.merchantsRepo.findOne({ where: { id } });
    if (!merchant) throw new NotFoundException("Merchant not found");
    return merchant;
  }

  async update(id: string, dto: UpdateMerchantDto): Promise<Merchant> {
    const merchant = await this.findOne(id);
    Object.assign(merchant, dto);
    return this.merchantsRepo.save(merchant);
  }

  async generateApiKey(id: string): Promise<{ apiKey: string }> {
    const merchant = await this.findOne(id);
    const rawKey = `cpk_${crypto.randomBytes(32).toString("hex")}`;
    const hash = await bcrypt.hash(rawKey, 10);

    merchant.apiKey = rawKey.substring(0, 12) + "...";
    merchant.apiKeyHash = hash;
    await this.merchantsRepo.save(merchant);

    return { apiKey: rawKey };
  }

  async getProfile(id: string) {
    const merchant = await this.findOne(id);
    const { passwordHash: _, apiKeyHash: __, ...profile } = merchant; // eslint-disable-line @typescript-eslint/no-unused-vars
    return profile;
  }
}
