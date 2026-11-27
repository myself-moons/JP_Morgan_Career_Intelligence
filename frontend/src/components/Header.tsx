import React from 'react';
import { AuthUser, HealthStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { Bell, BellOff, Compass, Database, LogOut, Moon, Sun } from 'lucide-react';
import { ThemeMode } from '../utils/theme';

interface HeaderProps {
  health: HealthStatus | null;
  loading: boolean;
  error: string | null;
  user: AuthUser | null;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onToggleAlerts: () => void;
  onRefreshHealth: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  loading,
  error,
  user,
  theme,
  onToggleTheme,
  onToggleAlerts,
  onRefreshHealth,
  onLogout,
}) => {
  const alertsOn = (user?.email_alerts_enabled ?? 1) === 1;

  return (
    <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white sticky top-0 z-30 transition-colors">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-1.5 sm:p-2 bg-blue-600 rounded-lg shrink-0">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight truncate">
                  Career Intelligence
                </h1>
                {health?.version && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/70 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-700 shrink-0">
                    v{health.version}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <button
              onClick={onRefreshHealth}
              className="hidden sm:inline-flex"
              title="Refresh API status"
            >
              <StatusBadge health={health} loading={loading} error={error} />
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {user && user.is_local_dev === 0 && (
              <button
                type="button"
                onClick={onToggleAlerts}
                className={`p-1.5 rounded-lg border transition ${
                  alertsOn
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
                title={
                  alertsOn
                    ? 'Daily job match emails ON (click to pause)'
                    : 'Daily job match emails OFF (click to enable)'
                }
                aria-label="Toggle daily job email alerts"
              >
                {alertsOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>
            )}

            {health?.environment === 'local' && health?.database === 'sqlite' && (
              <a
                href={health.db_console_url || 'http://127.0.0.1:8080'}
                target="_blank"
                rel="noreferrer"
                className="hidden md:inline-flex items-center p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                title="Local SQLite Console"
              >
                <Database className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              </a>
            )}

            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.display_name}
                    className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-600"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                    {user.display_name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline text-xs text-slate-700 dark:text-slate-200 font-medium max-w-[120px] truncate">
                  {user.display_name}
                </span>
                {user.is_local_dev === 0 && (
                  <button
                    onClick={onLogout}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                    title="Sign out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
