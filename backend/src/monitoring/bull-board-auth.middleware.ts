import type { Request, Response, NextFunction } from 'express';

export function bullBoardBasicAuthMiddleware(
  user: string,
  password: string,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const hdr = req.headers.authorization;
    if (!hdr?.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
      res.status(401).send('Authentication required');
      return;
    }
    let decoded: string;
    try {
      decoded = Buffer.from(hdr.slice(6), 'base64').toString('utf8');
    } catch {
      res.status(401).send('Invalid credentials');
      return;
    }
    const sep = decoded.indexOf(':');
    const u = sep >= 0 ? decoded.slice(0, sep) : decoded;
    const p = sep >= 0 ? decoded.slice(sep + 1) : '';
    if (u !== user || p !== password) {
      res.status(401).send('Invalid credentials');
      return;
    }
    next();
  };
}
