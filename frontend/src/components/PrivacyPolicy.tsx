import React from 'react';
import { ArrowLeft, Compass, Lock, Moon, ShieldCheck, Sun } from 'lucide-react';
import { ThemeMode } from '../utils/theme';

interface PrivacyPolicyProps {
  mode: 'privacy' | 'terms';
  theme: ThemeMode;
  onToggleTheme: () => void;
  onBackHome: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({
  mode,
  theme,
  onToggleTheme,
  onBackHome,
}) => {
  const isPrivacy = mode === 'privacy';

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Career Intelligence</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0">
            {isPrivacy ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">
              {isPrivacy ? 'Privacy Policy — Career Intelligence' : 'Terms of Use — Career Intelligence'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Effective Date: November 27, 2026
            </p>
          </div>
        </div>

        {isPrivacy ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8 space-y-6 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                1. Overview
              </h2>
              <p>
                <strong>Career Intelligence</strong> is a personal career preparation and skill-gap
                analysis web application. This Privacy Policy explains what information is collected
                when you sign in with Google, how your resumes and project entries are used, and how
                you control your data.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                2. Information We Collect
              </h2>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong>Google Account Information:</strong> When you sign in with Google, we
                  receive only your basic OpenID profile information — your Google account ID
                  (<code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">sub</code>),
                  email address, display name, and profile picture URL. We do <strong>not</strong>{' '}
                  request access to your Gmail, Google Drive, Contacts, or Calendar.
                </li>
                <li>
                  <strong>User-Provided Career Content:</strong> Any resumes (PDF, DOCX, or text),
                  Experience Vault project descriptions, target job descriptions, saved learning
                  links, and roadmap items you choose to add inside your workspace.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                3. How We Use Your Data
              </h2>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong>Private Workspace Isolation:</strong> Your resumes, Experience Vault
                  entries, and learning roadmap are strictly tied to your account and are never
                  shared with other users.
                </li>
                <li>
                  <strong>On-Demand AI Comparisons:</strong> AI analysis runs only when you
                  explicitly click an AI button (such as <em>Compare with AI</em> or{' '}
                  <em>Review with AI</em>). Before sending text to the Gemini API, email addresses,
                  phone numbers, and personal profile links are automatically redacted.
                </li>
                <li>
                  <strong>Optional Daily Match Digests:</strong> If daily job alerts are enabled in
                  your header bell toggle, an automated job computes role match summaries from your
                  saved profile and emails them to your registered address. You can pause or turn off
                  these emails at any time with one tap.
                </li>
                <li>
                  <strong>No Sale or Advertising:</strong> We never sell, rent, or share your
                  personal data or uploaded resumes with third-party advertisers or data brokers.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                4. Cookies &amp; Sessions
              </h2>
              <p>
                After signing in with Google, Career Intelligence stores an{' '}
                <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">HttpOnly</code>{' '}
                session cookie (<code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">jci_session</code>)
                strictly to keep you signed in securely over HTTPS, and stores your light/dark theme
                preference in browser <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">localStorage</code>.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                5. Data Retention &amp; Deletion
              </h2>
              <p>
                You can delete any uploaded resume, Experience Vault entry, custom job listing, or
                roadmap item directly from the app at any time. To request full account deletion,
                email{' '}
                <a
                  href="mailto:manthan.waghela@gmail.com"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  manthan.waghela@gmail.com
                </a>
                .
              </p>
            </section>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8 space-y-6 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                1. Purpose of the Platform
              </h2>
              <p>
                Career Intelligence is an educational and career-preparation tool designed to help
                candidates analyze publicly posted job requirements, organize project histories, and
                plan skill development. It is an independent tool and is not affiliated with or
                endorsed by JPMorgan Chase &amp; Co.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                2. Acceptable Use
              </h2>
              <p>
                You are responsible for the accuracy of the resumes, notes, and links you upload.
                Automated scraping, abuse of AI rate limits, or attempts to access another
                user&apos;s workspace are prohibited.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                3. No Warranty
              </h2>
              <p>
                Match estimates and AI-generated resume suggestions are provided &ldquo;as is&rdquo;
                for preparation support only and do not guarantee interview selection or employment
                outcomes. For support, contact{' '}
                <a
                  href="mailto:manthan.waghela@gmail.com"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  manthan.waghela@gmail.com
                </a>
                .
              </p>
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-5 px-4 sm:px-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Career Intelligence
            </span>
          </div>
          <button
            type="button"
            onClick={onBackHome}
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Return to App
          </button>
        </div>
      </footer>
    </div>
  );
};
