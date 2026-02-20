export class EncryptionService {
  private readonly algorithm = "aes-256-cbc";
  private readonly key = Buffer.from(
    process.env.ENCRYPTION_KEY || "default-encryption-key-32-chars!!",
    "utf8",
  ).slice(0, 32);

  encrypt(text: string): string {
    try {
      const crypto = require("crypto");
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");
      return iv.toString("hex") + ":" + encrypted;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  decrypt(encryptedText: string): string {
    try {
      const crypto = require("crypto");
      const [iv, encrypted] = encryptedText.split(":");
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.key,
        Buffer.from(iv, "hex"),
      );
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
}
