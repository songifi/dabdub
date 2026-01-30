import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';

@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
    protected async getTracker(req: Record<string, any>): Promise<string> {
        const apiKey = req.headers['x-api-key'];
        if (apiKey) {
            // If API Key is present, use it as the tracker key
            // You might want to validate the API key here or prefix it
            return `api-key:${apiKey}`;
        }
        // Fallback to IP address
        return req.ips.length ? req.ips[0] : req.ip;
    }
}
