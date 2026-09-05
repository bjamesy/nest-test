import { ExecutionContext } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { UploadInitiateRateLimitGuard } from './upload-initiate-rate-limit.guard.js';

function contextWithUser(userId: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: userId } }),
    }),
  } as unknown as ExecutionContext;
}

describe('UploadInitiateRateLimitGuard', () => {
  it('allows the request when under the limit', async () => {
    const storage = {
      increment: vi.fn().mockResolvedValue({
        totalHits: 3,
        timeToExpire: 60_000,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    };
    const guard = new UploadInitiateRateLimitGuard(storage);

    await expect(guard.canActivate(contextWithUser('user-1'))).resolves.toBe(true);
    expect(storage.increment).toHaveBeenCalledWith(
      'upload-initiate:user-1',
      60_000,
      10,
      60_000,
      'upload-initiate',
    );
  });

  it('throws ThrottlerException once the limit is exceeded', async () => {
    const storage = {
      increment: vi.fn().mockResolvedValue({
        totalHits: 11,
        timeToExpire: 60_000,
        isBlocked: true,
        timeToBlockExpire: 60_000,
      }),
    };
    const guard = new UploadInitiateRateLimitGuard(storage);

    await expect(guard.canActivate(contextWithUser('user-1'))).rejects.toThrow(
      ThrottlerException,
    );
  });
});
