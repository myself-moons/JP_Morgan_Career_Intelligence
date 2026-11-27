import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { LandingPage } from './components/LandingPage';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { Dashboard } from './pages/Dashboard';
import { JobLibrary } from './pages/JobLibrary';
import { SkillExplorer } from './pages/SkillExplorer';
import { ExperienceVault } from './pages/ExperienceVault';
import { MyRoadmap } from './pages/MyRoadmap';
import { ActiveTab, AuthConfig, AuthUser, HealthStatus } from './types';
import {
  checkHealth,
  fetchAuthConfig,
  fetchCurrentUser,
  logoutUser,
  updateEmailAlerts,
} from './services/api';
import { useTheme } from './utils/theme';

export const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [pathname, setPathname] = useState<string>(() => window.location.pathname.toLowerCase());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [authLoadError, setAuthLoadError] = useState<string | null>(null);

  const refreshHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await checkHealth();
      setHealth(data);
    } catch (err: any) {
      setHealthError(err?.message || 'Backend unreachable');
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  const initSession = async () => {
    setAuthChecked(false);
    setAuthLoadError(null);
    try {
      const cfg = await fetchAuthConfig();
      setAuthConfig(cfg);
      const me = await fetchCurrentUser();
      setUser(me);
    } catch (err: any) {
      setAuthConfig(null);
      setUser(null);
      setAuthLoadError(err?.message || 'Unable to reach backend API');
    } finally {
      setAuthChecked(true);
    }
  };

  useEffect(() => {
    refreshHealth();
    initSession();
    const onPopState = () => setPathname(window.location.pathname.toLowerCase());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateRoute = (nextPath: string) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setPathname(nextPath.toLowerCase());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
  };

  const handleToggleAlerts = async () => {
    if (!user) return;
    const nextEnabled = !(user.email_alerts_enabled ?? 1);
    const updated = await updateEmailAlerts(nextEnabled);
    setUser(updated);
  };

  if (pathname === '/privacy' || pathname === '/privacy/') {
    return (
      <PrivacyPolicy
        mode="privacy"
        theme={theme}
        onToggleTheme={toggleTheme}
        onBackHome={() => navigateRoute('/')}
      />
    );
  }

  if (pathname === '/terms' || pathname === '/terms/') {
    return (
      <PrivacyPolicy
        mode="terms"
        theme={theme}
        onToggleTheme={toggleTheme}
        onBackHome={() => navigateRoute('/')}
      />
    );
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
        Initializing workspace...
      </div>
    );
  }

  if (authLoadError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <div className="text-sm font-bold">Backend Service Unavailable</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Could not reach the API server ({authLoadError}). Ensure the backend is running and database connectivity is active.
          </p>
          <button
            type="button"
            onClick={() => {
              refreshHealth();
              initSession();
            }}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (authConfig?.auth_required && !user) {
    return (
      <LandingPage
        clientId={authConfig.google_client_id}
        version={authConfig.version}
        health={health}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigateRoute={navigateRoute}
        onSuccess={(signedUser) => setUser(signedUser)}
      />
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-800 dark:text-slate-100 pb-20 md:pb-0 transition-colors">
      <Header
        health={health}
        loading={healthLoading}
        error={healthError}
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleAlerts={handleToggleAlerts}
        onRefreshHealth={refreshHealth}
        onLogout={handleLogout}
      />

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 min-w-0 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 overflow-x-hidden">
        {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
        {activeTab === 'jobs' && <JobLibrary user={user} />}
        {activeTab === 'explorer' && <SkillExplorer />}
        {activeTab === 'vault' && <ExperienceVault />}
        {activeTab === 'roadmap' && <MyRoadmap />}
      </main>
    </div>
  );
};

export default App;
