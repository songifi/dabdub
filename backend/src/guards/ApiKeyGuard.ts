import { Request, Response, NextFunction } from "express";
import { ApiKeyService } from "../services/ApiKeyService";

export async function ApiKeyGuard(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing API key" });

  const rawKey = authHeader.replace("Bearer ", "");
  try {
    const merchantId = await new ApiKeyService().authenticate(rawKey);
    req.user = { id: merchantId, isMerchantApiRequest: true };
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
