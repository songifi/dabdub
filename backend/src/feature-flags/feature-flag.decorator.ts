import { Injectable, UseGuards, applyDecorators } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response, NextFunction } from 'express';
import { FeatureFlagsService } from './feature-flags.service';

export const FEATURE_FLAG_KEY = 'featureFlag';

export const FeatureFlag = (key: string) => {
  return applyDecorators(
    SetMetadata(FEATURE_FLAG_KEY, key),
    UseGuards(FeatureFlagGuard),
  );
};

@Injectable()
export class FeatureFlagGuard {
  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: import('@nestjs/common').ExecutionContext): Promise<boolean> {
    const key = this.reflector.get<string>(FEATURE_FLAG_KEY, context.getHandler());
    if (!key) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: { id: string; tier?: string } }>();
    const user = request.user;

    if (!user) return false;

    const isEnabled = await this.featureFlagsService.isEnabled(key, user.id, user.tier);
    
    if (!isEnabled) {
      const response = context.switchToHttp().getResponse<Response>();
      response.status(404).json({ statusCode: 404, message: 'Not Found' });
      return false;
    }

    return true;
  }
}
