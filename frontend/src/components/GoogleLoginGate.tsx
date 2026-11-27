import React, { useEffect, useRef, useState } from 'react';
import { Compass, Lock } from 'lucide-react';
import { loginWithGoogle } from '../services/api';
import { AuthUser } from '../types';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
          }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, any>) => void;
        };
      };
    };
  }
}

let initializedClientId: string | null = null;

interface GoogleLoginGateProps {
  clientId: string;
  onSuccess: (user: AuthUser) => void;
  embedded?: boolean;
}

export const GoogleLoginGate: React.FC<GoogleLoginGateProps> = ({
  clientId,
  onSuccess,
  embedded = false,
}) => {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState<boolean>(false);

  useEffect(() => {
    if (!clientId) return;

    const initGsi = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;
      if (initializedClientId !== clientId) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp) => {
            try {
              setSigningIn(true);
              setError(null);
              const user = await loginWithGoogle(resp.credential);
              onSuccessRef.current(user);
            } catch (err: any) {
              setError(err?.message || 'Google Sign-In failed');
            } finally {
              setSigningIn(false);
            }
          },
        });
        initializedClientId = clientId;
      }
      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 280,
      });
    };

    if (window.google?.accounts?.id) {
      initGsi();
      return;
    }

    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', initGsi);
      return () => existing.removeEventListener('load', initGsi);
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGsi;
    document.head.appendChild(script);
  }, [clientId]);

  const authBody = (
    <>
      {!clientId ? (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2 text-left">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Missing GOOGLE_CLIENT_ID in environment configuration.</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2.5">
          <div ref={buttonRef} className="min-h-[44px]" />
          {signingIn && <span className="text-xs text-slate-500 dark:text-slate-400">Signing in...</span>}
        </div>
      )}

      {error && (
        <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="space-y-3">{authBody}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 text-center space-y-5">
        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto">
          <Compass className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Career Intelligence</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sign in with Google to access your private projects, resumes, and roadmap.
          </p>
        </div>
        {authBody}
      </div>
    </div>
  );
};
