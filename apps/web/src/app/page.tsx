'use client';

import Link from 'next/link';
import { useAuth } from '@/context/auth-context';

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Large File Ingestion Pipeline</h1>
      <p className="text-neutral-600">
        Chunked, streamed uploads straight to object storage, with a Nest.js API handling
        auth, signed URLs, and job orchestration.
      </p>
      {!loading && (
        <div className="flex justify-center gap-3">
          {user ? (
            <Link
              href="/upload"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Go to uploads
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
