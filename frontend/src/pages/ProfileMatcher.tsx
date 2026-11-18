import React from 'react';
import { UserCheck, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';

export const ProfileMatcher: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Profile & Resume Intelligence</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            CardLyze portfolio evidence, resume document ingestion, and keyword coverage engine (FR-37 to FR-40).
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <UserCheck className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">Scheduled for Milestone M5</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Profile evidence matching, CardLyze project attribution, resume vs. JD keyword coverage (FR-38),
          and claimed-unsupported evidence audits (FR-40) will be fully implemented in Milestone M5.
        </p>
      </div>
    </div>
  );
};
