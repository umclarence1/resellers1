import { useCallback, useEffect, useRef, useState } from 'react';
import OtpInput from '@/components/ui/OtpInput';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
  /** Send a verification code when the component mounts (modals). */
  autoSendOnMount?: boolean;
};

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

/** Email OTP step-up for sensitive admin API actions. */
export default function AdminPasswordConfirm({
  value,
  onChange,
  error,
  className,
  autoSendOnMount = false,
}: Props) {
  const { user } = useAuth();
  const [digits, setDigits] = useState<string[]>(() =>
    value.length === 6 ? value.split('') : ['', '', '', '', '', '']
  );
  const [maskedEmail, setMaskedEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const syncDigits = useCallback(
    (next: string[]) => {
      setDigits(next);
      onChange(next.join(''));
    },
    [onChange]
  );

  const initialSendRef = useRef(false);

  const requestCode = useCallback(async () => {
    if (sending || cooldown > 0) return;
    setSending(true);
    setSendError('');
    try {
      const { data } = await api.post('/admin/action-otp/request');
      setMaskedEmail(data.data?.maskedEmail || (user?.email ? maskEmail(user.email) : ''));
      setSent(true);
      setCooldown(60);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send verification code');
    } finally {
      setSending(false);
    }
  }, [cooldown, sending, user?.email]);

  useEffect(() => {
    if (!autoSendOnMount || initialSendRef.current) return;
    initialSendRef.current = true;
    void requestCode();
  }, [autoSendOnMount, requestCode]);

  const displayEmail = maskedEmail || (user?.email ? maskEmail(user.email) : 'your admin email');

  return (
    <div className={cn('space-y-3', className)}>
      <div>
        <p className="text-sm font-medium text-gray-900">Email verification</p>
        <p className="text-xs text-gray-500 mt-1">
          {sent
            ? `Enter the 6-digit code sent to ${displayEmail}.`
            : `We will send a 6-digit code to ${displayEmail} to confirm this action.`}
        </p>
      </div>

      {!sent && autoSendOnMount && sending && (
        <p className="text-sm text-gray-500">Sending verification code…</p>
      )}

      {!sent && !autoSendOnMount && (
        <Button type="button" variant="outline" className="w-full" loading={sending} onClick={requestCode}>
          Send verification code
        </Button>
      )}

      {sent && (
        <>
          <OtpInput value={digits} onChange={syncDigits} disabled={sending} />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500">Code expires in 10 minutes.</p>
            <button
              type="button"
              className="text-xs font-medium text-gold hover:underline disabled:text-gray-400 disabled:no-underline"
              disabled={sending || cooldown > 0}
              onClick={requestCode}
            >
              {sending ? 'Sending…' : cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend code'}
            </button>
          </div>
        </>
      )}

      {import.meta.env.DEV && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
          Dev mode: use <span className="font-mono font-semibold">000000</span> when OTP email is skipped.
        </p>
      )}

      {(error || sendError) && (
        <p className="text-sm text-red-600">{error || sendError}</p>
      )}
    </div>
  );
}
