import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FolderKanban,
  Info,
  Trophy,
  X,
} from 'lucide-react';
import {
  fetchDashboardSummary,
  fetchJobById,
  fetchSkillEvidence,
  getExportCoverageUrl,
} from '../services/api';
import {
  ActiveTab,
  DashboardSummary,
  Job,
  SkillCoverageItem,
  SkillEvidenceResponse,
} from '../types';
import { formatDateDDMMYYYY } from '../utils/date';

interface DashboardProps {
  onNavigate: (tab: ActiveTab) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobLoading, setJobLoading] = useState<boolean>(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [scoreInfoPinned, setScoreInfoPinned] = useState<boolean>(false);
  const [scoreInfoHover, setScoreInfoHover] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Tap-to-inspect skill evidence sheet
  const [activeSkill, setActiveSkill] = useState<SkillCoverageItem | null>(null);
  const [evidence, setEvidence] = useState<SkillEvidenceResponse | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    fetchDashboardSummary()
      .then((data) => setSummary(data))
      .catch((err: any) => setError(err?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const handleOpenEvidence = async (skill: SkillCoverageItem) => {
    setActiveSkill(skill);
    setEvidenceLoading(true);
    try {
      const ev = await fetchSkillEvidence(skill.skill_id, 'Available');
      setEvidence(ev);
    } catch {
      setEvidence(null);
    } finally {
      setEvidenceLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-xs sm:text-sm text-slate-500">
        Loading recommendations and skills in demand...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP RECOMMENDED ROLES (Vault -> Resume -> Empty Prompt) */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-100 rounded-t-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 relative">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Top Recommended Roles
                </h2>
                <div
                  className="relative inline-flex items-center"
                  onMouseEnter={() => setScoreInfoHover(true)}
                  onMouseLeave={() => setScoreInfoHover(false)}
                >
                  <button
                    type="button"
                    aria-label="How match scores work"
                    aria-expanded={scoreInfoPinned || scoreInfoHover}
                    onClick={() => setScoreInfoPinned((prev) => !prev)}
                    className="p-0.5 rounded-full text-slate-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  {(scoreInfoPinned || scoreInfoHover) && (
                    <div
                      role="dialog"
                      aria-label="Scoring System Explanation"
                      className="fixed inset-x-3 top-20 sm:inset-x-auto sm:absolute sm:left-0 sm:top-full sm:mt-2 z-40 sm:w-80 p-3.5 rounded-xl bg-white border border-slate-200 shadow-xl text-left space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          How Your Match Scores Work
                        </span>
                        {scoreInfoPinned && (
                          <button
                            type="button"
                            onClick={() => {
                              setScoreInfoPinned(false);
                              setScoreInfoHover(false);
                            }}
                            className="text-slate-400 hover:text-slate-600 p-0.5"
                            aria-label="Close score explanation"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        <span className="font-bold text-orange-600">Orange (Quick Estimate):</span>{' '}
                        An instant automatic estimate based on matching skills, job wording, and career level — no AI usage required.
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        <span className="font-bold text-emerald-600">Green (AI Score):</span>{' '}
                        Saved automatically when you run <strong>Compare with AI</strong> in your Experience Vault. AI checks deeper details like years of experience and specialized domain requirements.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {summary && (
                <p className="text-[11px] sm:text-xs text-slate-500">{summary.source_label}</p>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate('vault')}
            className="self-start sm:self-auto inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            <span>Open Vault</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {!summary || summary.ranking_source === 'none' ? (
          <div className="p-6 text-center space-y-4">
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              {summary?.empty_prompt ||
                'Add your work/academic history or upload a resume to see tailored role rankings.'}
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
              <button
                onClick={() => onNavigate('vault')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
              >
                <FolderKanban className="w-4 h-4" />
                <span>Add Experience History</span>
              </button>
              <button
                onClick={() => onNavigate('vault')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
              >
                <FileText className="w-4 h-4" />
                <span>Upload Resume</span>
              </button>
            </div>
          </div>
        ) : summary.top_matches.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No active job postings available to rank yet. Add or sync jobs in Job Library.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {summary.top_matches.map((match, idx) => (
              <div
                key={match.job_id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={async () => {
                          setJobLoading(true);
                          setJobError(null);
                          setSelectedJob(null);
                          try {
                            const job = await fetchJobById(match.job_id);
                            setSelectedJob(job);
                          } catch (err) {
                            setJobError(
                              err instanceof Error ? err.message : 'Failed to load job details'
                            );
                          } finally {
                            setJobLoading(false);
                          }
                        }}
                        className="text-left text-sm font-bold text-slate-900 hover:text-blue-600 hover:underline leading-snug transition"
                      >
                        {match.title}
                      </button>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                        {match.external_job_id && (
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {match.external_job_id}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                          {match.role_family.split(':')[0]}
                        </span>
                        {match.capture_date && <span>Posted {formatDateDDMMYYYY(match.capture_date)}</span>}
                      </div>
                    </div>
                  </div>
                  {match.matched_skills.length > 0 && (
                    <div className="pl-8 flex flex-wrap gap-1">
                      {match.matched_skills.map((s) => (
                        <span
                          key={s}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pl-8 sm:pl-0 shrink-0">
                  <div className="text-left sm:text-right">
                    <div
                      className={`text-xs font-bold ${match.is_ai_score ? 'text-emerald-600' : 'text-orange-600'
                        }`}
                    >
                      {match.score}% {match.is_ai_score ? 'AI Score' : 'Quick Estimate'}
                    </div>
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full rounded-full ${match.is_ai_score ? 'bg-emerald-500' : 'bg-orange-500'
                          }`}
                        style={{ width: `${match.score}%` }}
                      />
                    </div>
                  </div>
                  {match.source_url ? (
                    <a
                      href={match.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shrink-0"
                    >
                      Go and Apply
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic px-1 shrink-0">
                      No apply link
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. SKILLS IN DEMAND (Mobile-Friendly Stacked Cards, Tap for Quotes) */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Skills in Demand</h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Across {summary?.analysable_jobs_count ?? 0} active job descriptions &bull; Tap a skill to read quotes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={getExportCoverageUrl('csv')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </a>
            <a
              href={getExportCoverageUrl('xlsx')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </a>
          </div>
        </div>

        {!summary || summary.skills_in_demand.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No extracted skills found yet. Add jobs in Job Library or open Explorer.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {summary.skills_in_demand.map((skill) => (
              <button
                key={skill.skill_id}
                onClick={() => handleOpenEvidence(skill)}
                className="w-full text-left p-4 hover:bg-slate-50 transition flex flex-col gap-2"
              >
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm font-bold text-slate-900 truncate">
                      {skill.canonical_name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-[130px] sm:max-w-none">
                      {skill.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-blue-600">
                    <span>
                      {skill.distinct_job_count}/{summary.analysable_jobs_count} ({skill.coverage_percentage}%)
                    </span>
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{ width: `${Math.min(100, skill.coverage_percentage)}%` }}
                  />
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span>Required: {skill.required_count}</span>
                  <span>&bull;</span>
                  <span>Preferred: {skill.preferred_count}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Mobile-Friendly Skill Evidence Modal / Bottom Sheet */}
      {activeSkill && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 overflow-hidden">
          <div className="bg-white w-full max-w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl min-w-0">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  {activeSkill.canonical_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Mentioned in {activeSkill.distinct_job_count} active job(s)
                </p>
              </div>
              <button
                onClick={() => setActiveSkill(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto overflow-x-hidden overscroll-contain space-y-3 min-w-0">
              {evidenceLoading ? (
                <div className="py-8 text-center text-xs text-slate-500">Loading quotes...</div>
              ) : !evidence || evidence.items.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">No snippets found.</div>
              ) : (
                evidence.items.map((item) => (
                  <div
                    key={`${item.job_id}-${item.requirement_type}`}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 min-w-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-slate-900 break-words min-w-0">
                        {item.job_title}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${item.requirement_type === 'Required'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                      >
                        {item.requirement_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 italic leading-relaxed break-words">
                      &ldquo;{item.evidence_snippet}&rdquo;
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile-Friendly Job Details Modal / Bottom Sheet */}
      {(jobLoading || selectedJob || jobError) && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 overflow-hidden">
          <div className="bg-white w-full max-w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl min-w-0">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug break-words">
                  {selectedJob ? selectedJob.title : 'Job Details'}
                </h3>
                {selectedJob && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedJob.external_job_id || selectedJob.source_job_id || `Job #${selectedJob.id}`} &bull; {selectedJob.company_name} &bull; {selectedJob.location}
                    {selectedJob.capture_date ? ` • Posted ${formatDateDDMMYYYY(selectedJob.capture_date)}` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedJob(null);
                  setJobError(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto overscroll-contain space-y-4">
              {jobLoading ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Loading job details...
                </div>
              ) : jobError ? (
                <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700">
                  {jobError}
                </div>
              ) : selectedJob ? (
                <>
                  {selectedJob.summary && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Summary
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                        {selectedJob.summary}
                      </p>
                    </div>
                  )}

                  {selectedJob.responsibilities && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Responsibilities
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                        {selectedJob.responsibilities}
                      </p>
                    </div>
                  )}

                  {selectedJob.qualifications && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Required Qualifications
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                        {selectedJob.qualifications}
                      </p>
                    </div>
                  )}

                  {selectedJob.preferred_qualifications && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Preferred Qualifications
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                        {selectedJob.preferred_qualifications}
                      </p>
                    </div>
                  )}

                  {!selectedJob.summary &&
                    !selectedJob.responsibilities &&
                    !selectedJob.qualifications &&
                    selectedJob.original_description && (
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Description
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                          {selectedJob.original_description}
                        </p>
                      </div>
                    )}
                </>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedJob(null);
                  setJobError(null);
                }}
                className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
              {selectedJob?.source_url && (
                <a
                  href={selectedJob.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
                >
                  Go and Apply
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
