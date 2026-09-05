import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectThrottlerStorage, ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy.js';

const WINDOW_MS = 60_000;
const LIMIT = 10;

/**
 * Per-user (not per-IP) limit on /uploads/initiate — each signed URL costs a
 * real R2 API call, so this is about abuse/cost protection, not brute force.
 * Applied after JwtAuthGuard (method-level @UseGuards order) so req.user is
 * already populated — a global guard can't see it, since global guards run
 * before controller/method-level ones.
 */
@Injectable()
export class UploadInitiateRateLimitGuard implements CanActivate {
  constructor(@InjectThrottlerStorage() private readonly storage: ThrottlerStorage) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const key = `upload-initiate:${request.user.id}`;

    // blockDuration must be a positive TTL — once totalHits exceeds the
    // limit, the underlying Lua script unconditionally SETs a block key
    // with this as its PX expiry, and Redis rejects `PX 0`.
    const record = await this.storage.increment(key, WINDOW_MS, LIMIT, WINDOW_MS, 'upload-initiate');
    if (record.totalHits > LIMIT) {
      throw new ThrottlerException();
    }
    return true;
  }
}
