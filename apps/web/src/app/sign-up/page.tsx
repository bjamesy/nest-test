'use client';

import { AuthForm } from '@/components/auth-form';
import { useAuth } from '@/context/auth-context';

export default function SignUpPage() {
  const { signUp } = useAuth();
  return <AuthForm mode="sign-up" onSubmit={signUp} />;
}
