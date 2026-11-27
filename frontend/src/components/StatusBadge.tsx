import React from 'react';
import { HealthStatus } from '../types';

interface StatusBadgeProps {
  health: HealthStatus | null;
  loading: boolean;
  error: string | null;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ health, loading, error }) => {
  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
        <span>Connecting...</span>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="flex items-center space-x-2 text-xs px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
        <span>Backend Offline</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 text-xs px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
      <span className="font-medium">
        v{health.version} ({health.database})
      </span>
    </div>
  );
};
