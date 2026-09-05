'use client';

import Link from 'next/link';
import { useAuth } from '@/context/auth-context';

export function NavBar() {
  const { user, loading, signOut } = useAuth();

  return (
    <header className="border-b border-neutral-200 bg-white">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-neutral-900">
          prep-proj
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {loading ? null : user ? (
            <>
              <Link href="/upload" className="text-neutral-700 hover:text-neutral-900">
                Upload
              </Link>
              <span className="text-neutral-500">{user.email}</span>
              <button
                onClick={signOut}
                className="rounded-md border border-neutral-300 px-3 py-1 text-neutral-700 hover:bg-neutral-100"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="text-neutral-700 hover:text-neutral-900">
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md bg-neutral-900 px-3 py-1 text-white hover:bg-neutral-800"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
