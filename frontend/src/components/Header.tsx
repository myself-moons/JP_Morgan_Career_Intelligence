import React from 'react';
import { HealthStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { Database, ShieldCheck, Compass } from 'lucide-react';

interface HeaderProps {
  health: HealthStatus | null;
  loading: boolean;
  error: string | null;
  onRefreshHealth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  loading,
  error,
  onRefreshHealth,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-inner">
              <Compass className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  JPMorgan Career Intelligence
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-900 text-blue-200 border border-blue-700">
                  v1.2 (M0)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Local-first JD Extraction & Comparative Analytics Platform
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <StatusBadge health={health} loading={loading} error={error} />

            {/* Quick access link to DB Console (FR-41) */}
            <a
              href="http://127.0.0.1:8080"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Open Live SQLite Web Console (FR-41)"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>DB Console (8080)</span>
            </a>

            <button
              onClick={onRefreshHealth}
              className="text-xs px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Re-check Backend Connection"
            >
              Check Health
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
