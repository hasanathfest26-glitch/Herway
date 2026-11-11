'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/features/api';
import { useWebAuth } from '@/features/auth/AuthProvider';
import { PrimaryButton, StandardCard, StandardInput, Toast } from '@/components/ui';

export default function LoginPage() {
  const { login } = useWebAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const user = await login(email, password);
        if (user.roles.includes('ADMIN')) router.push('/admin');
        else router.push('/partner');
      } else if (mode === 'forgot') {
        const res = await apiFetch<{ message: string }>('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        setNotice(res.message);
        setMode('reset');
      } else {
        await apiFetch('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email, token: resetToken, newPassword }),
        });
        setNotice('Password updated. Sign in with your new password.');
        setMode('login');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-md tablet:mt-12">
      <StandardCard className="space-y-5 p-6 tablet:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-[#00B6C7] text-white shadow-teal-glow">
            <Lock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[20px] font-extrabold leading-[26px] text-[#131A20] tablet:text-[22px] tablet:leading-[28px]">
              {mode === 'login'
                ? 'Herway Portal Sign In'
                : mode === 'forgot'
                  ? 'Password Recovery'
                  : 'Reset Password'}
            </h1>
            <p className="text-[13px] font-medium text-[#646F78]">
              Role-restricted access for Administrators &amp; Safe Haven Partners
            </p>
          </div>
        </div>

        {error && <Toast tone="error" message={error} onDismiss={() => setError(null)} />}
        {notice && <Toast tone="success" message={notice} onDismiss={() => setNotice(null)} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <StandardInput
            label="Email Address"
            type="text"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@herway"
          />

          {mode === 'login' && (
            <StandardInput
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          )}

          {mode === 'reset' && (
            <>
              <StandardInput
                label="Recovery Token"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Paste recovery token"
              />
              <StandardInput
                label="New Password (min 8 chars)"
                type="password"
                minLength={8}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </>
          )}

          <PrimaryButton
            type="submit"
            loading={submitting}
            disabled={submitting}
            className="w-full"
          >
            {submitting
              ? 'Authenticating...'
              : mode === 'login'
                ? 'Sign In Securely'
                : mode === 'forgot'
                  ? 'Request Recovery Token'
                  : 'Reset Password'}
          </PrimaryButton>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ECEEF0] pt-4 text-[13px]">
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'forgot' : 'login')}
            className="min-h-[36px] font-semibold text-[#0099A8] hover:underline"
          >
            {mode === 'login' ? 'Forgot password?' : 'Back to sign in'}
          </button>
          <span className="inline-flex items-center gap-1.5 font-medium text-[#646F78]">
            <ShieldCheck className="h-4 w-4 text-[#059669]" />
            Session Revocation Active
          </span>
        </div>
      </StandardCard>
    </div>
  );
}
