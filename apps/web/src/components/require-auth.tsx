'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/sign-in');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
