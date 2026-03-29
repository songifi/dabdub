import { getRepository } from "typeorm";
import { ApiKey, ApiPermission } from "../entities/ApiKey";
import crypto from "crypto";
import { nanoid } from "nanoid";

export class ApiKeyService {
  private repo = getRepository(ApiKey);

  async create(merchantId: string, dto: { name: string; permissions: ApiPermission[]; expiresAt?: Date }, pin: string) {
    // Verify merchant is verified + PIN check
    if (!(await this.verifyMerchant(merchantId, pin))) throw new Error("Unauthorized");

    const activeKeys = await this.repo.count({ where: { merchantId, isActive: true } });
    if (activeKeys >= 5) throw new Error("Max 5 active keys per merchant");

    const prefix = dto.name.includes("test") ? "ck_test_" : "ck_live_";
    const rawKey = `${prefix}${nanoid(32)}`;
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const apiKey = this.repo.create({
      merchantId,
      name: dto.name,
      keyPrefix,
      keyHash,
      permissions: dto.permissions,
      expiresAt: dto.expiresAt ?? null,
    });

    await this.repo.save(apiKey);

    return rawKey; // full key returned only once
  }

  async authenticate(rawKey: string) {
    const keyPrefix = rawKey.substring(0, 8);
    const key = await this.repo.findOne({ where: { keyPrefix } });
    if (!key) throw new Error("Invalid API key");

    const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
    if (hash !== key.keyHash || !key.isActive) throw new Error("Unauthorized");

    if (key.expiresAt && new Date() > key.expiresAt) throw new Error("Expired API key");

    key.lastUsedAt = new Date();
    await this.repo.save(key);

    return key.merchantId;
  }

  async rotate(keyId: string, merchantId: string) {
    const key = await this.repo.findOneOrFail({ where: { id: keyId, merchantId } });
    key.isActive = false;

    const rawKey = `ck_live_${nanoid(32)}`;
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const newKey = this.repo.create({
      merchantId,
      name: key.name,
      keyPrefix,
      keyHash,
      permissions: key.permissions,
      expiresAt: key.expiresAt,
    });

    await this.repo.save([key, newKey]);
    return rawKey;
  }

  async revoke(keyId: string, merchantId: string) {
    const key = await this.repo.findOneOrFail({ where: { id: keyId, merchantId } });
    key.isActive = false;
    await this.repo.save(key);
  }

  private async verifyMerchant(merchantId: string, pin: string): Promise<boolean> {
    // Implement merchant verification + PIN check
    return true;
  }
}
