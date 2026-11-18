import React from 'react';
import { GraduationCap, BookOpen, CheckSquare } from 'lucide-react';

export const LearningTracker: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Learning Intelligence & Skill Gap Tracker</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Targeted learning paths mapped directly to uncovered required and preferred skills across target JDs.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">Scheduled for Milestone M6</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Curated learning resources, gap remediation roadmaps, and manual progress checklist tracking
          will be active in Milestone M6.
        </p>
      </div>
    </div>
  );
};
