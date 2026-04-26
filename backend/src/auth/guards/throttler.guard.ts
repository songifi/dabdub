import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Authenticated merchants are tracked by merchantId; others by IP
    if (req.user?.merchantId) {
      return `merchant:${req.user.merchantId}`;
    }
    return req.ip ?? req.connection?.remoteAddress ?? "unknown";
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    // Exempt /health from all rate limiting
    if ((req.path as string)?.endsWith("/health")) {
      return true;
    }
    return false;
  }

  protected async handleRequest(requestProps: any): Promise<boolean> {
    const { context } = requestProps;
    const req = context.switchToHttp().getRequest();
    const isAuthenticated = Boolean(req.user?.merchantId);

    // Only apply the throttler that matches the authentication state
    const throttlerName: string = requestProps.throttler?.name ?? "";
    if (throttlerName === "authenticated" && !isAuthenticated) return true;
    if (throttlerName === "default" && isAuthenticated) return true;

    return super.handleRequest(requestProps);
  }
}
