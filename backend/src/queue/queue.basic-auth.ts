import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

function unauthorized(res: {
  setHeader(name: string, value: string): void;
  status(code: number): { send(body: string): void };
}): void {
  res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
  res.status(401).send('Authentication required');
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createBullBoardBasicAuth(
  username: string,
  password: string,
): RequestHandler {
  return (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Basic ')) {
      unauthorized(res);
      return;
    }

    const decoded = Buffer.from(authorization.slice(6), 'base64').toString(
      'utf8',
    );
    const separatorIndex = decoded.indexOf(':');

    if (separatorIndex < 0) {
      unauthorized(res);
      return;
    }

    const providedUsername = decoded.slice(0, separatorIndex);
    const providedPassword = decoded.slice(separatorIndex + 1);

    if (
      !safeEquals(providedUsername, username) ||
      !safeEquals(providedPassword, password)
    ) {
      unauthorized(res);
      return;
    }

    next();
  };
}
