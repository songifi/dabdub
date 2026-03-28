import type { Request } from 'express';

export type SandboxAuthContext = {
  apiKey: string;
  merchantId: string;
  sandbox: true;
};

export type SandboxRequest = Request & {
  sandboxAuth: SandboxAuthContext;
};
