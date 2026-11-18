import React from 'react';
import { HealthStatus } from '../types';
import {
  Briefcase,
  CheckCircle2,
  FileText,
  TrendingUp,
  Cpu,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface DashboardProps {
  health: HealthStatus | null;
  onNavigate: (tab: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ health, onNavigate }) => {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 rounded-xl p-6 text-white shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 text-xs font-semibold px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Phase 1.0 (Milestone M0) Active</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              JPMorgan Career Intelligence Platform
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Local-first single-user workspace for dissecting JPMorgan Chase job postings,
              extracting canonical skills, evaluating portfolio evidence, and tracking learning paths.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => onNavigate('jobs')}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition shadow-sm"
            >
              <span>Explore Job Library</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Target JDs
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">11</span>
            <span className="text-xs text-slate-500">JPMorgan roles (N=10 active)</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Across Role Families A, B, and C
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Architecture Mode
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">100% Local</span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 font-medium">
            FastAPI + SQLite (Zero Cloud Latency)
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Profile & Resume
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">FR-37 / 38</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Resume vs JD keyword coverage engine
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Database Console
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">FR-41</span>
          </div>
          <div className="mt-2 text-xs text-amber-600 font-medium">
            Live Web SQL Inspection (Port 8080)
          </div>
        </div>
      </div>

      {/* Implementation Roadmap Status */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center space-x-2">
          <span>Implementation Roadmap Overview</span>
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
            <div className="flex items-center space-x-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-emerald-900">Milestone M0: Foundation, Scaffolding & Setup</span>
            </div>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
              In Progress / Current
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600">
            <div className="flex items-center space-x-3">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
              <span>Milestone M1: Local SQLite Database & 11 Baseline Jobs Ingestion</span>
            </div>
            <span className="text-xs text-slate-500">Next Phase</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600">
            <div className="flex items-center space-x-3">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
              <span>Milestone M2: Text Preprocessing & Regex/Rule Extraction Pipeline</span>
            </div>
            <span className="text-xs text-slate-400">Scheduled</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600">
            <div className="flex items-center space-x-3">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
              <span>Milestone M3: Canonical Taxonomy, Alias Harmonization & Human Review</span>
            </div>
            <span className="text-xs text-slate-400">Scheduled</span>
          </div>
        </div>
      </div>
    </div>
  );
};
