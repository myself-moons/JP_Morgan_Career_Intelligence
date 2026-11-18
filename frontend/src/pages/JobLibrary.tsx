import React from 'react';
import { Briefcase, Plus, Filter, Search, ExternalLink } from 'lucide-react';

export const JobLibrary: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Job Library</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            11 Target JPMorgan Chase job postings (10 active, 1 unavailable) across Role Families A, B, and C.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition">
            <Plus className="w-4 h-4" />
            <span>Add Job (Paste / Upload)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search titles, requisition IDs, locations..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled
          />
        </div>
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white" disabled>
            <option>All Role Families (A, B, C)</option>
            <option>Family A: Core Software Engineering</option>
            <option>Family B: Data Engineering & Analytics</option>
            <option>Family C: Specialized Architecture & Reference</option>
          </select>
          <select className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white" disabled>
            <option>All Statuses</option>
            <option>Available (10)</option>
            <option>JD Unavailable (1)</option>
          </select>
        </div>
      </div>

      {/* Placeholder table for M1 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-8 text-center">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <Briefcase className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">11 Baseline Jobs Ready for Milestone M1</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          The job catalog and raw text ingestion service will be initialized in Phase 1.1 (M1),
          loading the full JPMorgan Chase dataset directly into local SQLite storage.
        </p>
      </div>
    </div>
  );
};
