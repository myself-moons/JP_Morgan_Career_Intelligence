import React from 'react';
import {
  ArrowDown,
  Briefcase,
  CheckCircle2,
  Compass,
  FolderKanban,
  Layers,
  LayoutDashboard,
  Lock,
  Map,
  Moon,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Target,
} from 'lucide-react';
import { GoogleLoginGate } from './GoogleLoginGate';
import { AuthUser, HealthStatus } from '../types';
import { ThemeMode } from '../utils/theme';

interface LandingPageProps {
  clientId: string;
  version?: string;
  health?: HealthStatus | null;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNavigateRoute?: (path: string) => void;
  onSuccess: (user: AuthUser) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  clientId,
  version,
  health,
  theme,
  onToggleTheme,
  onNavigateRoute,
  onSuccess,
}) => {
  const scrollToSignIn = () => {
    const el = document.getElementById('signin-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const features = [
    {
      icon: <LayoutDashboard className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      title: 'Home Dashboard',
      text: 'See which jobs match your background best and which skills show up most across openings.',
      accent: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800',
    },
    {
      icon: <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      title: 'Job Library',
      text: 'Browse saved roles, upload a job PDF, or pull fresh openings right into one clean list.',
      accent: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800',
    },
    {
      icon: <Layers className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />,
      title: 'Skill Explorer',
      text: 'Pick the jobs you care about and see which skills every role wants vs. just one role.',
      accent: 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800',
    },
    {
      icon: <FolderKanban className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      title: 'Experience Vault',
      text: 'Write down your full projects and coursework—even details that do not fit on a 1-page resume. Compare them against any job with AI.',
      accent: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
    },
    {
      icon: <Map className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      title: 'My Roadmap',
      text: 'Keep a simple checklist of skills you want to learn, along with links to courses or guides.',
      accent: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
    },
  ];

  const steps = [
    {
      step: '1',
      title: 'Sign in with Google',
      text: 'Get a private space for your own resume, projects, and notes.',
    },
    {
      step: '2',
      title: 'Add your background',
      text: 'Upload a resume or jot down projects you have worked on.',
    },
    {
      step: '3',
      title: 'See gaps & get ready',
      text: 'Spot missing skills in seconds and build your learning checklist.',
    },
  ];

  const promises = [
    {
      icon: <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
      title: 'Made for your phone',
      text: 'Simple cards and easy tabs—no tiny tables to pinch or zoom.',
    },
    {
      icon: <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      title: 'Private to you',
      text: 'Only you can see your resume, projects, and study checklist.',
    },
    {
      icon: <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
      title: 'Personal info protected',
      text: 'Your email and phone number are removed before AI reads anything.',
    },
    {
      icon: <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
      title: 'AI only when you ask',
      text: 'Nothing runs in the background—you tap a button whenever you want AI help.',
    },
  ];

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-blue-600 shrink-0">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm sm:text-base font-bold tracking-tight truncate">
                Career Intelligence
              </span>
              {(version || health?.version) && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/70 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-700 shrink-0">
                  v{version || health?.version}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 transition"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            <button
              type="button"
              onClick={scrollToSignIn}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-xs"
            >
              <span>Sign In</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800/80">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[300px] rounded-full bg-blue-500/15 dark:bg-blue-600/20 blur-3xl"
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-200 text-xs font-medium">
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span>Mobile-First Career Prep</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                Find the right jobs. See what skills you are missing. Get ready faster.
              </h1>

              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                Upload your resume or list your projects. We compare them against real job openings,
                show what already matches, and give you a clear checklist of what to learn next.
              </p>

              {/* Sign-In Card */}
              <div
                id="signin-card"
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-5 max-w-md space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold">Get started in seconds</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Sign in with Google. Your resume and notes stay private to you.
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 shrink-0">
                    <Compass className="w-5 h-5" />
                  </div>
                </div>

                <GoogleLoginGate clientId={clientId} onSuccess={onSuccess} embedded />

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Free to use
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Private space
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Works great on mobile
                  </span>
                </div>
              </div>
            </div>

            {/* Clean Mobile App Preview */}
            <div className="lg:col-span-5">
              <div className="max-w-[340px] mx-auto bg-slate-900 dark:bg-slate-900 rounded-[28px] border border-slate-300 dark:border-slate-700 shadow-2xl p-2.5">
                <div className="bg-slate-50 dark:bg-slate-950 rounded-[20px] overflow-hidden border border-slate-200 dark:border-slate-800">
                  <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-blue-600">
                        <Compass className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-xs font-bold">Career Intelligence</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                      Mobile View
                    </span>
                  </div>

                  <div className="p-3.5 space-y-3">
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Top Job Match
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          Strong Fit
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Data Quality &amp; Governance Analyst
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {['SQL', 'Python', 'Data Quality'].map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-blue-500" />
                          What Jobs Ask For
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                          <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                            Must-Have
                          </div>
                          <div className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                            Most roles
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800">
                          <div className="text-[10px] font-bold text-blue-800 dark:text-blue-300">
                            Common
                          </div>
                          <div className="text-[9px] text-blue-600 dark:text-blue-400 mt-0.5">
                            2+ roles
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                            Bonus
                          </div>
                          <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                            1 role
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-200 dark:border-indigo-800 p-3 space-y-1">
                      <div className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>AI Resume Tips</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                        Spots project details missing from your resume and suggests simple edits.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-2 grid grid-cols-5 text-center text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                    <div className="text-blue-600 dark:text-blue-400 flex flex-col items-center gap-0.5">
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      <span>Home</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>Jobs</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <Compass className="w-3.5 h-3.5" />
                      <span>Explorer</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <FolderKanban className="w-3.5 h-3.5" />
                      <span>Vault</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <Map className="w-3.5 h-3.5" />
                      <span>Roadmap</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What's Inside */}
      <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">What you can do inside</h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Five simple tabs to help you prepare without messy spreadsheets.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3"
            >
              <div className={`inline-flex p-2.5 rounded-xl border ${f.accent}`}>{f.icon}</div>
              <h3 className="text-base font-bold">{f.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {f.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {steps.map((s) => (
              <div
                key={s.step}
                className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-2"
              >
                <span className="inline-flex w-7 h-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-bold">
                  {s.step}
                </span>
                <h3 className="text-sm sm:text-base font-bold">{s.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy & Simple Promises */}
      <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 space-y-6">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
          Safe, private, and easy to use
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {promises.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">{p.icon}</div>
                <h3 className="text-sm font-bold">{p.title}</h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-extrabold">Ready to see how you match?</h3>
            <p className="text-xs sm:text-sm text-blue-100">
              Sign in with Google to open your private Career Intelligence workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={scrollToSignIn}
            className="self-start sm:self-auto px-5 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-blue-50 text-xs sm:text-sm font-bold transition shrink-0"
          >
            Sign in with Google
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-5 px-4 sm:px-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Career Intelligence
            </span>
            {(version || health?.version) && <span>&bull; v{version || health?.version}</span>}
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <a
              href="/privacy"
              onClick={(e) => {
                if (onNavigateRoute) {
                  e.preventDefault();
                  onNavigateRoute('/privacy');
                }
              }}
              className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              onClick={(e) => {
                if (onNavigateRoute) {
                  e.preventDefault();
                  onNavigateRoute('/terms');
                }
              }}
              className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
            >
              Terms of Use
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
