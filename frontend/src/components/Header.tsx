import React from 'react';
import { AuthUser, HealthStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { Compass, Database, LogOut } from 'lucide-react';

interface HeaderProps {
  health: HealthStatus | null;
  loading: boolean;
  error: string | null;
  user: AuthUser | null;
  onRefreshHealth: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  loading,
  error,
  user,
  onRefreshHealth,
  onLogout,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-1.5 sm:p-2 bg-blue-600 rounded-lg shrink-0">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                  Career Intelligence
                </h1>
                {health?.version && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-900 text-blue-200 border border-blue-700 shrink-0">
                    v{health.version}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={onRefreshHealth}
              className="hidden sm:inline-flex"
              title="Refresh API status"
            >
              <StatusBadge health={health} loading={loading} error={error} />
            </button>

            {health?.environment === 'local' && health?.database === 'sqlite' && (
              <a
                href={health.db_console_url || 'http://127.0.0.1:8080'}
                target="_blank"
                rel="noreferrer"
                className="hidden md:inline-flex items-center p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                title="Local SQLite Console"
              >
                <Database className="w-4 h-4 text-amber-400" />
              </a>
            )}

            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.display_name}
                    className="w-7 h-7 rounded-full border border-slate-600"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                    {user.display_name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline text-xs text-slate-200 font-medium max-w-[120px] truncate">
                  {user.display_name}
                </span>
                {user.is_local_dev === 0 && (
                  <button
                    onClick={onLogout}
                    className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
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
