import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Edit3,
  FileCheck2,
  FolderGit2,
  GraduationCap,
  Layers,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  fetchJobs,
  fetchProfileJobMatch,
  fetchProfileOverview,
  fetchResumes,
  fetchTaxonomySkills,
  updateUserProfile,
  upsertProfileEvidence,
  deleteProfileEvidence,
} from '../services/api';
import {
  Job,
  ProfileEvidenceItem,
  ProfileJobMatchResponse,
  ProfileOverviewResponse,
  ResumeDocument,
  TaxonomySkill,
} from '../types';

const EVIDENCE_STATUSES = ['Demonstrated', 'Partial', 'Learning', 'Not demonstrated'] as const;
const CONTRIBUTION_OPTIONS = [
  'Independent',
  'AI-assisted',
  'Supervised',
  'Collaborative',
  'Tested',
  'Validated',
];

export const ProfileMatcher: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'portfolio'>('audit');
  const [overview, setOverview] = useState<ProfileOverviewResponse | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [allSkills, setAllSkills] = useState<TaxonomySkill[]>([]);

  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [matchResult, setMatchResult] = useState<ProfileJobMatchResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Add / Edit Evidence Modal
  const [showEvidenceModal, setShowEvidenceModal] = useState<boolean>(false);
  const [editSkillId, setEditSkillId] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<string>('Demonstrated');
  const [editContributions, setEditContributions] = useState<string[]>(['Independent']);
  const [editProject, setEditProject] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [savingEvidence, setSavingEvidence] = useState<boolean>(false);

  // Profile Summary Edit Mode
  const [editingProfile, setEditingProfile] = useState<boolean>(false);
  const [eduSummary, setEduSummary] = useState<string>('');
  const [expSummary, setExpSummary] = useState<string>('');
  const [projSummary, setProjSummary] = useState<string>('');

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [profData, jobsData, resumesData, skillsData] = await Promise.all([
        fetchProfileOverview(),
        fetchJobs({ status: 'Available' }),
        fetchResumes(),
        fetchTaxonomySkills(),
      ]);

      setOverview(profData);
      setEduSummary(profData.profile.education_summary || '');
      setExpSummary(profData.profile.experience_summary || '');
      setProjSummary(profData.profile.projects_summary || '');

      setJobs(jobsData.jobs);
      setResumes(resumesData);
      setAllSkills(skillsData);

      const defaultResume = resumesData.find((r) => r.is_active === 1) || resumesData[0];
      const defaultJob = jobsData.jobs[0];
      if (defaultResume) setSelectedResumeId(defaultResume.id);
      if (defaultJob) setSelectedJobId(defaultJob.id);

      if (defaultJob) {
        const audit = await fetchProfileJobMatch(defaultJob.id, defaultResume?.id);
        setMatchResult(audit);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load profile intelligence data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const runAudit = async (jobId: number | null, resumeId: number | null) => {
    if (!jobId) return;
    try {
      setAuditLoading(true);
      const data = await fetchProfileJobMatch(jobId, resumeId ?? undefined);
      setMatchResult(data);
    } catch (err: any) {
      setError(err?.message || 'Audit failed');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleJobChange = (jobId: number) => {
    setSelectedJobId(jobId);
    runAudit(jobId, selectedResumeId);
  };

  const handleResumeChange = (resumeId: number) => {
    setSelectedResumeId(resumeId);
    runAudit(selectedJobId, resumeId);
  };

  const openEvidenceModal = (existing?: ProfileEvidenceItem, prefillSkillId?: number) => {
    if (existing) {
      setEditSkillId(existing.skill_id);
      setEditStatus(existing.evidence_status);
      setEditContributions(
        existing.contribution_type
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      );
      setEditProject(existing.source_project || '');
      setEditNotes(existing.evidence_description || '');
    } else {
      setEditSkillId(prefillSkillId || allSkills[0]?.id || 0);
      setEditStatus('Demonstrated');
      setEditContributions(['Independent']);
      setEditProject('');
      setEditNotes('');
    }
    setShowEvidenceModal(true);
  };

  const toggleContribution = (tag: string) => {
    setEditContributions((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSaveEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSkillId) return;
    try {
      setSavingEvidence(true);
      await upsertProfileEvidence({
        skill_id: editSkillId,
        evidence_status: editStatus,
        contribution_type: editContributions.length > 0 ? editContributions.join(', ') : 'Independent',
        source_project: editProject.trim() || undefined,
        evidence_description: editNotes.trim() || undefined,
      });
      setShowEvidenceModal(false);
      const updated = await fetchProfileOverview();
      setOverview(updated);
      if (selectedJobId) {
        await runAudit(selectedJobId, selectedResumeId);
      }
    } catch (err: any) {
      alert(err?.message || 'Could not save evidence');
    } finally {
      setSavingEvidence(false);
    }
  };

  const handleDeleteEvidence = async (id: number) => {
    if (!window.confirm('Remove this skill evidence record?')) return;
    await deleteProfileEvidence(id);
    const updated = await fetchProfileOverview();
    setOverview(updated);
    if (selectedJobId) {
      await runAudit(selectedJobId, selectedResumeId);
    }
  };

  const handleSaveProfileSummary = async () => {
    const saved = await updateUserProfile({
      education_summary: eduSummary,
      experience_summary: expSummary,
      projects_summary: projSummary,
    });
    if (overview) {
      setOverview({ ...overview, profile: saved });
    }
    setEditingProfile(false);
    if (selectedJobId) {
      await runAudit(selectedJobId, selectedResumeId);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Demonstrated':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Partial':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Learning':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getDimensionBadgeStyle = (badge: string) => {
    if (badge === 'Strong') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (badge === 'Partial') return 'bg-blue-100 text-blue-800 border-blue-300';
    if (badge === 'Eligibility Gap') return 'bg-rose-100 text-rose-800 border-rose-300';
    if (badge === 'Gap') return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-slate-100 text-slate-700 border-slate-300';
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-slate-500">
        Loading your profile evidence, CardLyze attributions, and resume audit...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Profile Evidence & Resume Audit</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare your resume line-by-line against target JPMorgan jobs, separate degree rules from technical skills, and track CardLyze independent vs. AI-assisted work.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-1 bg-slate-100 rounded-lg border border-slate-200 flex items-center">
            <button
              onClick={() => setActiveSubTab('audit')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
                activeSubTab === 'audit'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Resume vs. Job Audit</span>
            </button>
            <button
              onClick={() => setActiveSubTab('portfolio')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
                activeSubTab === 'portfolio'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>CardLyze & Skill Proof ({overview?.evidence_items.length || 0})</span>
            </button>
          </div>
          <button
            onClick={() => openEvidenceModal()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Skill Proof</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SUB-TAB 1: DETERMINISTIC RESUME VS JD AUDIT */}
      {activeSubTab === 'audit' && (
        <div className="space-y-6">
          {/* Selector Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                1. Pick Your Resume
              </label>
              <select
                value={selectedResumeId || ''}
                onChange={(e) => handleResumeChange(Number(e.target.value))}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.is_active === 1 ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                2. Pick Target JPMorgan Role
              </label>
              <select
                value={selectedJobId || ''}
                onChange={(e) => handleJobChange(Number(e.target.value))}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    [{j.external_job_id || `ID-${j.id}`}] {j.title} ({j.role_family.split(':')[0]})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {auditLoading && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Comparing resume lines, CardLyze evidence, and education rules...</span>
            </div>
          )}

          {!auditLoading && matchResult && (
            <>
              {/* FR-39 Resume Parse Check Banner */}
              <div
                className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                  matchResult.parse_check.status === 'Healthy'
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {matchResult.parse_check.status === 'Healthy' ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>
                    Resume Parse Check: <strong>{matchResult.parse_check.status}</strong> (
                    {matchResult.parse_check.char_count.toLocaleString()} characters across{' '}
                    {matchResult.parse_check.line_count} lines)
                  </span>
                </div>
                {matchResult.parse_check.warnings.length > 0 && (
                  <span className="text-[11px]">{matchResult.parse_check.warnings[0]}</span>
                )}
              </div>

              {/* FR-40 / BR-13 Claimed-Unsupported Warning Panel */}
              {matchResult.claimed_unsupported.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-amber-950">
                        Keywords Found in Resume Without Project Proof ({matchResult.claimed_unsupported.length})
                      </h3>
                      <p className="text-xs text-amber-800 mt-0.5">
                        Mentioning a skill on your resume doesn&apos;t prove hands-on readiness yet. Add a real project deliverable or keep these honest before interviews.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {matchResult.claimed_unsupported.map((item) => (
                      <div
                        key={item.skill_id}
                        className="bg-white border border-amber-200 rounded-lg p-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{item.canonical_name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                              {item.current_evidence_status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 italic truncate" title={item.resume_matching_line}>
                            Resume line: &ldquo;{item.resume_matching_line}&rdquo;
                          </p>
                        </div>
                        <button
                          onClick={() => openEvidenceModal(undefined, item.skill_id)}
                          className="shrink-0 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold transition"
                        >
                          Add Proof
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FR-21: 6 Separate Fit Dimension Cards (No single composite score) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Six Separate Fit Dimensions (No Single Hidden Score)</span>
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Degree rules are kept separate from learnable skills
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {matchResult.dimensions.map((dim) => (
                    <div
                      key={dim.dimension_key}
                      className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <h4 className="text-xs font-bold text-slate-900">{dim.dimension_label}</h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getDimensionBadgeStyle(
                              dim.status_badge
                            )}`}
                          >
                            {dim.status_badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{dim.summary}</p>
                      </div>

                      <div className="space-y-1.5 text-[11px]">
                        {dim.matched_items.length > 0 && (
                          <div className="text-emerald-700 bg-emerald-50/70 rounded p-2 border border-emerald-100">
                            <strong className="block text-[10px] uppercase tracking-wider mb-0.5">
                              Verified / Aligned:
                            </strong>
                            <ul className="list-disc list-inside space-y-0.5">
                              {dim.matched_items.slice(0, 4).map((m, idx) => (
                                <li key={idx} className="truncate" title={m}>
                                  {m}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {dim.gap_items.length > 0 && (
                          <div className="text-rose-800 bg-rose-50/70 rounded p-2 border border-rose-100">
                            <strong className="block text-[10px] uppercase tracking-wider mb-0.5">
                              Gaps / Eligibility Flags:
                            </strong>
                            <ul className="list-disc list-inside space-y-0.5">
                              {dim.gap_items.slice(0, 4).map((g, idx) => (
                                <li key={idx}>{g}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FR-38: Side-by-Side Line-by-Line Resume vs JD Coverage Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Side-by-Side Skill & Line Check ({matchResult.skill_coverage.length} Skills Extracted)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Matches each job requirement directly against the exact line in your resume and your verified project proof.
                    </p>
                  </div>
                </div>

                {matchResult.skill_coverage.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No canonical skills extracted for this job yet. Visit Skill Analysis to run extraction.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Skill & Type</th>
                          <th className="py-3 px-4">In Resume?</th>
                          <th className="py-3 px-4">Matching Line in Job Description</th>
                          <th className="py-3 px-4">Matching Line in Resume</th>
                          <th className="py-3 px-4">Verified Project Proof</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {matchResult.skill_coverage.map((row) => (
                          <tr key={row.skill_id} className="hover:bg-slate-50/70 align-top">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{row.canonical_name}</div>
                              <span
                                className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                  row.requirement_type === 'Required'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}
                              >
                                {row.requirement_type === 'Required' ? 'Must-Have' : row.requirement_type}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {row.mentioned_in_resume ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Yes
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                                  <X className="w-3.5 h-3.5" />
                                  Missing
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[11px] text-slate-600 max-w-xs">
                              {row.jd_evidence_snippet ? (
                                <span className="italic">&ldquo;{row.jd_evidence_snippet}&rdquo;</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[11px] text-slate-700 max-w-xs">
                              {row.resume_matching_line ? (
                                <span className="bg-emerald-50/70 px-1.5 py-0.5 rounded border border-emerald-100 block">
                                  &ldquo;{row.resume_matching_line}&rdquo;
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Not mentioned in active resume</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusStyle(
                                  row.profile_evidence_status
                                )}`}
                              >
                                {row.profile_evidence_status}
                              </span>
                              {row.contribution_type && (
                                <div className="text-[10px] text-slate-500 mt-1">
                                  {row.contribution_type}
                                  {row.source_project ? ` • ${row.source_project}` : ''}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* SUB-TAB 2: CARDLYZE & SKILL PROOF PORTFOLIO */}
      {activeSubTab === 'portfolio' && overview && (
        <div className="space-y-6">
          {/* Education & Experience Summary Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {overview.profile.full_name} &bull; Background &amp; Degree Baseline
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Used to check formal education rules separately from technical skill gaps.
                  </p>
                </div>
              </div>
              {!editingProfile ? (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Background</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingProfile(false)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfileSummary}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              )}
            </div>

            {editingProfile ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Education Summary</label>
                  <textarea
                    rows={3}
                    value={eduSummary}
                    onChange={(e) => setEduSummary(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Experience Summary</label>
                  <textarea
                    rows={3}
                    value={expSummary}
                    onChange={(e) => setExpSummary(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Projects &amp; CardLyze Split</label>
                  <textarea
                    rows={3}
                    value={projSummary}
                    onChange={(e) => setProjSummary(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                    <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                    <span>Education</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{overview.profile.education_summary}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                    <Award className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Work &amp; Teaching</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{overview.profile.experience_summary}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                    <span>CardLyze &amp; Portfolio</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{overview.profile.projects_summary}</p>
                </div>
              </div>
            )}
          </div>

          {/* Evidence Inventory Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Skill Evidence &amp; Contribution Log (CardLyze Attribution)
                </h3>
                <p className="text-xs text-slate-500">
                  Tracks what you built independently vs. AI-assisted &amp; tested so interview claims stay 100% honest.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                  Demonstrated: {overview.status_counts['Demonstrated'] || 0}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                  Partial: {overview.status_counts['Partial'] || 0}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                  Learning: {overview.status_counts['Learning'] || 0}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Skill</th>
                    <th className="py-3 px-4">Evidence Status</th>
                    <th className="py-3 px-4">Contribution Split</th>
                    <th className="py-3 px-4">Project / Source</th>
                    <th className="py-3 px-4">Deliverable Proof</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overview.evidence_items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 align-top">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.canonical_name}</div>
                        <div className="text-[10px] text-slate-400">{item.category}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusStyle(
                            item.evidence_status
                          )}`}
                        >
                          {item.evidence_status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {item.contribution_type.split(',').map((tag) => (
                            <span
                              key={tag.trim()}
                              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                                tag.trim() === 'AI-assisted'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[11px] font-medium text-slate-700">
                        {item.source_project || '—'}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-600 max-w-sm">
                        {item.evidence_description || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEvidenceModal(item)}
                          className="text-blue-600 hover:text-blue-800 p-1 mr-1"
                          title="Edit evidence"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEvidence(item.id)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                          title="Delete evidence"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Skill Evidence Modal */}
      {showEvidenceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Record Skill Proof &amp; Attribution</h3>
              <button onClick={() => setShowEvidenceModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEvidence} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Canonical Skill</label>
                <select
                  value={editSkillId}
                  onChange={(e) => setEditSkillId(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  {allSkills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.canonical_name} ({s.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Evidence Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  {EVIDENCE_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Contribution Type (select all that apply — FR-19)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CONTRIBUTION_OPTIONS.map((opt) => {
                    const selected = editContributions.includes(opt);
                    return (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => toggleContribution(opt)}
                        className={`px-2.5 py-1 rounded-lg border font-medium transition ${
                          selected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Source Project / Role</label>
                <input
                  type="text"
                  placeholder="e.g. CardLyze, EbixCash TMS, Kaggle Competition"
                  value={editProject}
                  onChange={(e) => setEditProject(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Deliverable Explanation</label>
                <textarea
                  rows={3}
                  placeholder="Describe the tangible artifact, query, notebook, or test you created..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEvidenceModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEvidence}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  {savingEvidence ? 'Saving...' : 'Save Skill Proof'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
