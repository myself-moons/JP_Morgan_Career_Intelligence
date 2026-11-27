import React from 'react';
import {
  ArrowDown,
  Briefcase,
  CheckCircle2,
  Compass,
  Cpu,
  FolderKanban,
  Globe,
  Layers,
  LayoutDashboard,
  Lock,
  Map,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
} from 'lucide-react';
import { GoogleLoginGate } from './GoogleLoginGate';
import { AuthUser, HealthStatus } from '../types';

interface LandingPageProps {
  clientId: string;
  version?: string;
  health?: HealthStatus | null;
  onSuccess: (user: AuthUser) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  clientId,
  version,
  health,
  onSuccess,
}) => {
  const scrollToSignIn = () => {
    const el = document.getElementById('signin-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const modules = [
    {
      icon: <LayoutDashboard className="w-5 h-5 text-blue-600" />,
      badge: '3-Tier Ranking',
      title: 'Smart Dashboard',
      description:
        'Ranks target roles from your Experience Vault first, falls back to your active Resume, and separates instant local Quick Estimates from optional AI Fit Scores.',
      accent: 'bg-blue-50 border-blue-100',
    },
    {
      icon: <Briefcase className="w-5 h-5 text-indigo-600" />,
      badge: 'Live Sync + Upload',
      title: 'Job Description Library',
      description:
        'Sync live JPMorgan Chase requisitions via the Oracle Recruiting Cloud API, upload PDF/DOCX postings, or paste raw text with automatic section extraction.',
      accent: 'bg-indigo-50 border-indigo-100',
    },
    {
      icon: <Layers className="w-5 h-5 text-cyan-600" />,
      badge: 'Deduplicated',
      title: 'Skill Explorer',
      description:
        'Shortlist specific jobs or filter by role family to split skills into Common Core, Shared, and Role-Specific buckets with verbatim JD evidence snippets.',
      accent: 'bg-cyan-50 border-cyan-100',
    },
    {
      icon: <FolderKanban className="w-5 h-5 text-emerald-600" />,
      badge: 'Mini-RAG',
      title: 'Experience Vault',
      description:
        'Store deep project, academic, and work narratives beyond a 1-page resume. Run Compare with AI for grounded strengths, real gaps, and plain-text resume tips.',
      accent: 'bg-emerald-50 border-emerald-100',
    },
    {
      icon: <Map className="w-5 h-5 text-amber-600" />,
      badge: 'Action Plan',
      title: 'My Roadmap',
      description:
        'Build a clean, deduplicated skill goal list with live canonical autocomplete, attach personal course/certification links, and request optional AI roadmap reviews.',
      accent: 'bg-amber-50 border-amber-100',
    },
  ];

  const steps = [
    {
      step: '01',
      title: 'Sign in privately',
      detail:
        'Authenticate with Google OIDC. Your Experience Vault, uploaded resumes, and roadmap are isolated to your account via HttpOnly session cookies.',
    },
    {
      step: '02',
      title: 'Capture real project depth',
      detail:
        'Add detailed project narratives to your Experience Vault or upload a PDF/DOCX/TXT resume. Skills normalize automatically to canonical tags.',
    },
    {
      step: '03',
      title: 'Spot genuine gaps & execute',
      detail:
        'Explore Common Core skills across target roles, run on-demand Mini-RAG comparisons, and track focused study goals in My Roadmap.',
    },
  ];

  const trustPillars = [
    {
      icon: <Smartphone className="w-4 h-4 text-blue-400" />,
      title: 'Mobile-First Ergonomics',
      detail: 'Stacked tap-friendly cards, bottom tab bar, and zero horizontal-scroll tables on phones.',
    },
    {
      icon: <Cpu className="w-4 h-4 text-emerald-400" />,
      title: 'Zero Background AI Calls',
      detail: 'Browsing, filtering, and Quick Estimates run 100% deterministically. Gemini runs only when you tap an AI button.',
    },
    {
      icon: <ShieldCheck className="w-4 h-4 text-indigo-400" />,
      title: 'PII-Scrubbed & Cached',
      detail: 'Emails, phone numbers, and personal URLs are redacted before Gemini calls; embeddings and results cache via SHA-256.',
    },
    {
      icon: <Lock className="w-4 h-4 text-amber-400" />,
      title: 'Per-User Data Isolation',
      detail: 'Strict row-level scoping in PostgreSQL ensures your private narratives, resumes, and notes stay strictly yours.',
    },
  ];

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-900 flex flex-col">
      {/* Sticky Mobile-First Top Navigation */}
      <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur border-b border-slate-800/80 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-blue-600 shadow-sm shrink-0">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm sm:text-base font-bold tracking-tight truncate">
                Career Intelligence
              </span>
              {(version || health?.version) && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-900/80 text-blue-200 border border-blue-700/80 shrink-0">
                  v{version || health?.version}
                </span>
              )}
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition">
              Capabilities
            </a>
            <a href="#how-it-works" className="hover:text-white transition">
              How It Works
            </a>
            <a href="#security" className="hover:text-white transition">
              Privacy &amp; AI Safety
            </a>
          </nav>

          <button
            type="button"
            onClick={scrollToSignIn}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold transition shadow-sm shrink-0"
          >
            <span>Sign In</span>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Hero Section (Dark Fintech Navy Gradient -> Mobile-First Vertical Rhythm) */}
      <section className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 text-white overflow-hidden">
        {/* Subtle decorative background radial glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[560px] h-[340px] rounded-full bg-blue-600/20 blur-3xl"
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left / Top: Pitch + Embedded Google Sign-In */}
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-200 text-[11px] sm:text-xs font-medium">
                <Smartphone className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                <span>Mobile-First Career Prep &amp; Role Intelligence</span>
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight leading-[1.15] text-white">
                Turn Target Job Descriptions Into a Clear, Measurable Action Plan.
              </h1>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                JPMorgan Career Intelligence (JCI) helps you decode real fintech &amp; data roles,
                separate common core skills from single-role noise, compare your full project depth
                in an AI-assisted Experience Vault, and manage a clean learning roadmap — right from
                your phone.
              </p>

              {/* Sign-In Card directly accessible above/near the fold on mobile */}
              <div
                id="signin-card"
                className="bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-xl p-5 sm:p-6 max-w-md space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      Access Your Private Workspace
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sign in with Google to open your Experience Vault, Resumes &amp; Roadmap.
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                    <Compass className="w-5 h-5" />
                  </div>
                </div>

                <div className="pt-1">
                  <GoogleLoginGate clientId={clientId} onSuccess={onSuccess} embedded />
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Private per-user storage
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Live JPMC Careers sync
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    On-demand Gemini AI
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                <a
                  href="#features"
                  className="inline-flex items-center gap-1.5 text-blue-300 hover:text-blue-200 font-medium transition"
                >
                  <span>Explore all 5 platform modules</span>
                  <ArrowDown className="w-3.5 h-3.5" />
                </a>
                {health?.database && (
                  <span className="inline-flex items-center gap-1.5 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>
                      System {health.status} &bull; {health.database.toUpperCase()}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Right / Bottom: Mobile-First App Workspace Preview Card */}
            <div className="lg:col-span-5">
              <div className="max-w-[360px] mx-auto bg-slate-950 rounded-[28px] border border-slate-700/80 shadow-2xl p-3">
                {/* Phone Top Notch / Status Bar */}
                <div className="bg-slate-50 rounded-[20px] overflow-hidden text-slate-900 border border-slate-200">
                  <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
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

                  {/* Mock Workspace Cards */}
                  <div className="p-3.5 space-y-3">
                    {/* Card 1: Top Recommended Role */}
                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Ranked From Vault
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          AI Score
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900">
                        Data Quality &amp; Governance Analyst
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                          SQL
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                          Python
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100 font-medium">
                          Data Lineage
                        </span>
                      </div>
                    </div>

                    {/* Card 2: Skill Explorer Buckets */}
                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-blue-600" />
                          Skill Explorer Buckets
                        </span>
                        <span className="text-[10px] text-slate-400">Tap to inspect JD</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                          <div className="text-[10px] font-bold text-emerald-800">Common Core</div>
                          <div className="text-[9px] text-emerald-600 mt-0.5">High Priority</div>
                        </div>
                        <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
                          <div className="text-[10px] font-bold text-blue-800">Shared</div>
                          <div className="text-[9px] text-blue-600 mt-0.5">2+ Roles</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-100 border border-slate-200">
                          <div className="text-[10px] font-bold text-slate-700">Role-Specific</div>
                          <div className="text-[9px] text-slate-500 mt-0.5">Targeted</div>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Mini-RAG Insight */}
                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          Experience Vault Mini-RAG
                        </span>
                        <span className="text-[9px] font-semibold text-indigo-600 bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                          Compare with AI
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">
                        Surfaces project evidence missed on a 1-page resume and generates plain-English bullet tips.
                      </p>
                    </div>
                  </div>

                  {/* Mock Bottom Mobile Tab Bar */}
                  <div className="bg-white border-t border-slate-200 px-2 py-2 grid grid-cols-5 text-center text-[9px] font-semibold text-slate-500">
                    <div className="text-blue-600 flex flex-col items-center gap-0.5">
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

      {/* Capabilities Grid */}
      <section id="features" className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-16 space-y-8">
        <div className="max-w-2xl space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Built For Real Preparation
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Five focused modules. Zero spreadsheet clutter.
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Every view is designed for 375px phone screens first and scales smoothly to desktop,
            backed by PostgreSQL and deterministic-first analytics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {modules.map((mod) => (
            <div
              key={mod.title}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className={`p-2.5 rounded-xl border ${mod.accent}`}>{mod.icon}</div>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {mod.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{mod.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {mod.description}
                </p>
              </div>
            </div>
          ))}

          {/* Bonus Live Sync Highlight Card */}
          <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-2xl border border-slate-800 p-5 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-400/30">
                  <Globe className="w-5 h-5 text-blue-300" />
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  CSV &amp; Excel Ready
                </span>
              </div>
              <h3 className="text-base font-bold">Live API Sync &amp; Portable Exports</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Keep your library fresh with live Oracle Recruiting Cloud requisition syncing, stale
                role detection, and one-tap CSV/Excel exports for jobs, skill coverage, and your
                roadmap.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
          <div className="max-w-2xl space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Workflow
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              From raw job postings to focused execution in 3 steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {steps.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-2.5"
              >
                <span className="inline-block font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-600 text-white">
                  {item.step}
                </span>
                <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy & AI Quota Safety */}
      <section id="security" className="bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
          <div className="max-w-2xl space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Trust &amp; Engineering Hygiene
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight">
              Private by default. Honest about AI vs. deterministic math.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trustPillars.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
                    {pillar.icon}
                  </div>
                  <h3 className="text-sm font-bold text-white">{pillar.title}</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{pillar.detail}</p>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-extrabold text-white">
                Ready to map your skills against live target roles?
              </h3>
              <p className="text-xs sm:text-sm text-blue-100">
                Sign in with your Google account to open your private Career Intelligence workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={scrollToSignIn}
              className="self-start sm:self-auto px-5 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-blue-50 text-xs sm:text-sm font-bold transition shadow-sm shrink-0"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 text-slate-400 py-5 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-slate-200">JPMorgan Career Intelligence</span>
            {(version || health?.version) && <span>&bull; v{version || health?.version}</span>}
          </div>
          <div className="text-[11px] text-slate-500 text-center sm:text-right">
            Mobile-First FastAPI + React + PostgreSQL &bull; Deployed on Google Cloud Run
          </div>
        </div>
      </footer>
    </div>
  );
};
