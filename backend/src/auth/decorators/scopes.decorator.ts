import { SetMetadata } from '@nestjs/common';
import type { ApiScope } from '../scopes';

export const Scopes = (...scopes: ApiScope[]) => SetMetadata('scopes', scopes);
