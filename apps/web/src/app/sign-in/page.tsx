'use client';

import { AuthForm } from '@/components/auth-form';
import { useAuth } from '@/context/auth-context';

export default function SignInPage() {
  const { signIn } = useAuth();
  return <AuthForm mode="sign-in" onSubmit={signIn} />;
}
