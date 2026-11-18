import React from 'react';
import { FileSearch, Sparkles, Filter, CheckCircle2 } from 'lucide-react';

export const SkillAnalysis: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Skill Extraction & Analysis</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Deterministic regex and rule-based extraction with canonical skill mapping and human-in-the-loop review.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <FileSearch className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">Scheduled for Milestones M2 & M3</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Regex-based extraction rules, canonical taxonomy, alias map normalization, and human review verification
          will be active upon completion of Milestone M2 and M3.
        </p>
      </div>
    </div>
  );
};
