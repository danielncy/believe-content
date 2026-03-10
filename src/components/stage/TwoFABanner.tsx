'use client';

import { useState, useEffect, useRef } from 'react';

type BannerState = 'hidden' | 'required' | 'submitting' | 'success' | 'error';

export default function TwoFABanner() {
  const [state, setState] = useState<BannerState>('hidden');
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [postsRescheduled, setPostsRescheduled] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Poll for 2FA status every 30s
  useEffect(() => {
    async function check2FA() {
      try {
        const res = await fetch('/api/phantom/2fa');
        if (res.ok) {
          const data = await res.json();
          if (data.required && state === 'hidden') {
            setState('required');
          } else if (!data.required && state === 'required') {
            setState('hidden');
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }

    check2FA();
    const interval = setInterval(check2FA, 30000);

    return () => clearInterval(interval);
  }, [state]);

  // Auto-focus input when banner appears
  useEffect(() => {
    if (state === 'required' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state]);

  // Auto-hide success after 5s
  useEffect(() => {
    if (state === 'success') {
      const timer = setTimeout(() => setState('hidden'), 5000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  async function handleSubmit() {
    if (!/^\d{6}$/.test(code)) {
      setErrorMsg('Enter a 6-digit code');
      setState('error');
      return;
    }

    setState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/phantom/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (data.success) {
        setPostsRescheduled(data.postsRescheduled || 0);
        setState('success');
        setCode('');
      } else {
        setErrorMsg(data.error || 'Verification failed');
        setState('error');
      }
    } catch {
      setErrorMsg('Network error — try again');
      setState('error');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }

  if (state === 'hidden') return null;

  return (
    <div className="mx-4 mb-4 overflow-hidden rounded-xl border border-amber-700 bg-amber-900/30">
      {/* Success state */}
      {state === 'success' && (
        <div className="px-4 py-4 text-center">
          <p className="text-sm font-medium text-green-400">
            2FA verified — {postsRescheduled} post{postsRescheduled !== 1 ? 's' : ''} will resume publishing
          </p>
        </div>
      )}

      {/* Input state (required, submitting, error) */}
      {state !== 'success' && (
        <div className="px-4 py-4">
          <p className="text-sm font-medium text-amber-300">
            Facebook 2FA Required
          </p>
          <p className="mt-1 text-xs text-amber-400/70">
            Enter the 6-digit code from your authenticator app or SMS
          </p>

          <div className="mt-3 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(val);
                if (state === 'error') setState('required');
              }}
              onKeyDown={handleKeyDown}
              placeholder="000000"
              disabled={state === 'submitting'}
              className="flex-1 rounded-lg border border-amber-700 bg-neutral-900 px-4 py-3 text-center text-lg font-mono tracking-[0.3em] text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={state === 'submitting' || code.length !== 6}
              className="min-h-[48px] rounded-lg bg-amber-700 px-5 text-sm font-medium text-white transition-colors hover:bg-amber-600 active:bg-amber-500 disabled:opacity-50"
            >
              {state === 'submitting' ? 'Verifying...' : 'Submit'}
            </button>
          </div>

          {state === 'error' && errorMsg && (
            <p className="mt-2 text-xs text-red-400">{errorMsg}</p>
          )}
        </div>
      )}
    </div>
  );
}
