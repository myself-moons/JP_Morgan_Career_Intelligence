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
      <div className="flex items-center space-x-2 text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
        <span>Connecting to backend...</span>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="flex items-center space-x-2 text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
        <span>Backend Offline (Local 8000)</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
      <span className="font-medium">Backend {health.version} ({health.database})</span>
    </div>
  );
};
