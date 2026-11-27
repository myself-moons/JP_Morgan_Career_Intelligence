import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  ExternalLink,
  FileText,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  activateResume,
  compareVaultWithAI,
  createTextResume,
  createVaultEntry,
  deleteResume,
  deleteVaultEntry,
  fetchJobs,
  fetchResumes,
  fetchVaultEntries,
  getResumePdfUrl,
  updateVaultEntry,
  uploadResumeFile,
} from '../services/api';
import {
  ExperienceEntry,
  Job,
  ResumeDocument,
  VaultCompareResponse,
} from '../types';
import { SkillTagInput } from '../components/SkillTagInput';

export const ExperienceVault: React.FC = () => {
  const [entries, setEntries] = useState<ExperienceEntry[]>([]);
  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Entry Add/Edit Modal
  const [showEntryModal, setShowEntryModal] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState<string>('');
  const [org, setOrg] = useState<string>('');
  const [roleNote, setRoleNote] = useState<string>('');
  const [narrative, setNarrative] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [savingEntry, setSavingEntry] = useState<boolean>(false);

  // Mini-RAG AI Comparison
  const [jobSearch, setJobSearch] = useState<string>('');
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [modelMode, setModelMode] = useState<string>('gemini-3.8-flash');
  const [compareResult, setCompareResult] = useState<VaultCompareResponse | null>(null);
  const [activeResultJobId, setActiveResultJobId] = useState<number | null>(null);
  const [comparing, setComparing] = useState<boolean>(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Collapsible Simple Resumes Panel (PDF / DOCX / Text, zero LaTeX)
  const [showResumes, setShowResumes] = useState<boolean>(false);
  const [resumeName, setResumeName] = useState<string>('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumePasteText, setResumePasteText] = useState<string>('');
  const [uploadingResume, setUploadingResume] = useState<boolean>(false);
  const [resumeErr, setResumeErr] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [vaultData, resumesData, jobsData] = await Promise.all([
        fetchVaultEntries(),
        fetchResumes(),
        fetchJobs({ status: 'All' }),
      ]);
      setEntries(vaultData);
      setResumes(resumesData);
      setJobs(jobsData.jobs.filter((j) => j.status !== 'JD unavailable'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openModal = (entry?: ExperienceEntry) => {
    if (entry) {
      setEditingId(entry.id);
      setTitle(entry.title);
      setOrg(entry.organization_or_project || '');
      setRoleNote(entry.contribution_note || '');
      setNarrative(entry.detailed_narrative);
      setTags(entry.skill_tags);
    } else {
      setEditingId(null);
      setTitle('');
      setOrg('');
      setRoleNote('');
      setNarrative('');
      setTags([]);
    }
    setShowEntryModal(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || narrative.trim().length < 10) return;
    try {
      setSavingEntry(true);
      if (editingId) {
        await updateVaultEntry(editingId, {
          title: title.trim(),
          organization_or_project: org.trim() || undefined,
          contribution_note: roleNote.trim() || undefined,
          detailed_narrative: narrative.trim(),
          skill_tags: tags,
        });
      } else {
        await createVaultEntry({
          title: title.trim(),
          organization_or_project: org.trim() || undefined,
          contribution_note: roleNote.trim() || undefined,
          detailed_narrative: narrative.trim(),
          skill_tags: tags,
        });
      }
      setShowEntryModal(false);
      setEntries(await fetchVaultEntries());
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!window.confirm('Delete this Experience Vault entry?')) return;
    await deleteVaultEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const toggleJob = (jobId: number) => {
    setSelectedJobIds((prev) => {
      if (prev.includes(jobId)) {
        return prev.filter((id) => id !== jobId);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, jobId];
    });
  };

  const runCompareAI = async (forceRefresh: boolean = false) => {
    if (selectedJobIds.length === 0) return;
    try {
      setComparing(true);
      setCompareError(null);
      const res = await compareVaultWithAI({
        job_ids: selectedJobIds,
        model_mode: modelMode,
        force_refresh: forceRefresh,
      });
      setCompareResult(res);
      if (res.per_job_results && res.per_job_results.length > 0) {
        setActiveResultJobId(res.per_job_results[0].job_id);
      } else {
        setActiveResultJobId(null);
      }
    } catch (err: any) {
      setCompareError(err?.message || 'Comparison failed');
    } finally {
      setComparing(false);
    }
  };

  const handleUploadResume = async (e: React.FormEvent) => {
    e.preventDefault();
    setResumeErr(null);
    try {
      setUploadingResume(true);
      if (resumeFile) {
        await uploadResumeFile(resumeName.trim() || resumeFile.name, resumeFile);
      } else if (resumePasteText.trim().length >= 20) {
        await createTextResume(resumeName.trim() || 'Pasted Resume', resumePasteText.trim());
      } else {
        setResumeErr('Select a PDF/DOCX/TXT file or paste at least 20 characters of resume text.');
        return;
      }
      setResumeName('');
      setResumeFile(null);
      setResumePasteText('');
      setResumes(await fetchResumes());
    } catch (err: any) {
      setResumeErr(err?.message || 'Upload failed');
    } finally {
      setUploadingResume(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Experience Vault</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Store full project &amp; academic work beyond a 1-page resume and compare against roles.
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Entry</span>
        </button>
      </div>

      {/* 1. Experience Entries List */}
      <section className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            Loading Experience Vault...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              No work or academic history added yet.
            </p>
            <button
              onClick={() => openModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Entry</span>
            </button>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{entry.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {entry.organization_or_project && <span>{entry.organization_or_project}</span>}
                    {entry.contribution_note && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                        {entry.contribution_note}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openModal(entry)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {entry.detailed_narrative}
              </p>

              {entry.skill_tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {entry.skill_tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </section>

      {/* 2. Mini-RAG Job Comparison */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Compare Against Target Roles</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Matches your detailed history against target jobs and suggests plain-text resume updates.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={modelMode}
              onChange={(e) => setModelMode(e.target.value)}
              className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="gemini-3.8-flash">gemini-3.8-flash</option>
              <option value="gemini-flash-latest">gemini-flash-latest</option>
              <option value="gemini-flash-lite-latest">gemini-flash-lite-latest</option>
              <option value="gemini-pro-latest">gemini-pro-latest</option>
            </select>
            <button
              onClick={() => runCompareAI(false)}
              disabled={comparing || selectedJobIds.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{comparing ? 'Running...' : 'Compare with AI'}</span>
            </button>
          </div>
        </div>

        {/* Search-only Job Selector */}
        <div className="space-y-2.5">
          {selectedJobIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedJobIds.map((jid) => {
                const job = jobs.find((j) => j.id === jid);
                if (!job) return null;
                return (
                  <button
                    key={jid}
                    type="button"
                    onClick={() => toggleJob(jid)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 dark:bg-blue-600 text-white text-[11px] font-semibold"
                  >
                    <span className="truncate max-w-[220px]">
                      {job.external_job_id ? `${job.external_job_id}: ` : ''}
                      {job.title}
                    </span>
                    <span className="text-slate-300 ml-0.5">&times;</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedJobIds([])}
                className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline ml-1"
              >
                Clear
              </button>
            </div>
          )}

          <input
            type="text"
            value={jobSearch}
            onChange={(e) => setJobSearch(e.target.value)}
            disabled={selectedJobIds.length >= 3}
            placeholder={
              selectedJobIds.length >= 3
                ? 'Maximum 3 roles selected — remove one to search another'
                : `Search ${jobs.length} jobs by title or ID (${selectedJobIds.length}/3 selected)...`
            }
            className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          />

          {jobSearch.trim().length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto overscroll-contain">
              {jobs
                .filter((j) => {
                  const q = jobSearch.trim().toLowerCase();
                  return (
                    j.title.toLowerCase().includes(q) ||
                    (j.external_job_id || '').toLowerCase().includes(q) ||
                    j.role_family.toLowerCase().includes(q)
                  );
                })
                .slice(0, 15)
                .map((job) => {
                  const active = selectedJobIds.includes(job.id);
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => {
                        toggleJob(job.id);
                        setJobSearch('');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs border text-left transition ${active
                        ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-900 dark:border-blue-600 font-semibold'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                      {job.external_job_id ? `${job.external_job_id}: ` : ''}
                      {job.title}
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {compareError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300">
            {compareError}
          </div>
        )}

        {compareResult && (() => {
          const perJobs = compareResult.per_job_results || [];
          const activeJobResult =
            perJobs.find((p) => p.job_id === activeResultJobId) || perJobs[0] || null;

          const displaySummary = activeJobResult ? activeJobResult.summary : compareResult.summary;
          const displayStrengths = activeJobResult
            ? activeJobResult.strengths_from_history
            : compareResult.strengths_from_history;
          const displayGaps = activeJobResult ? activeJobResult.gaps : compareResult.gaps;
          const displaySuggestions = activeJobResult
            ? activeJobResult.resume_suggestions
            : compareResult.resume_suggestions;

          return (
            <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                    {compareResult.model_used}
                  </span>
                  {compareResult.is_cached && (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-medium">
                      Cached
                    </span>
                  )}
                  {compareResult.fallback_note && (
                    <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-medium">
                      {compareResult.fallback_note}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => runCompareAI(true)}
                  disabled={comparing}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh AI</span>
                </button>
              </div>

              {/* Per-Job Title Switcher Tabs */}
              {perJobs.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {perJobs.map((pj) => {
                    const isTabActive = activeJobResult?.job_id === pj.job_id;
                    return (
                      <button
                        key={pj.job_id}
                        type="button"
                        onClick={() => setActiveResultJobId(pj.job_id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition inline-flex items-center gap-1.5 ${isTabActive
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                      >
                        <span>
                          {pj.external_job_id ? `${pj.external_job_id}: ` : ''}
                          {pj.job_title}
                        </span>
                        {pj.fit_score != null && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isTabActive
                                ? 'bg-white/20 text-white'
                                : pj.is_ai_score
                                  ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-orange-50 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300'
                              }`}
                          >
                            {pj.fit_score}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {activeJobResult && activeJobResult.fit_score != null && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`font-bold px-2.5 py-1 rounded-lg border ${activeJobResult.is_ai_score
                        ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800'
                        : 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/70 border-orange-200 dark:border-orange-800'
                      }`}
                  >
                    {activeJobResult.fit_score}% {activeJobResult.is_ai_score ? 'AI Score' : 'Quick Estimate'}
                  </span>
                  {activeJobResult.is_ai_score && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Saved to your Home dashboard rankings
                    </span>
                  )}
                </div>
              )}

              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                {displaySummary}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                  <h4 className="font-bold text-emerald-900 dark:text-emerald-200">Covered by Your History</h4>
                  <ul className="list-disc list-inside space-y-1 text-emerald-800 dark:text-emerald-300">
                    {displayStrengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1.5">
                  <h4 className="font-bold text-amber-900 dark:text-amber-200">Gaps</h4>
                  <ul className="list-disc list-inside space-y-1 text-amber-800 dark:text-amber-300">
                    {displayGaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-1.5">
                  <h4 className="font-bold text-blue-900 dark:text-blue-200">Resume Suggestions</h4>
                  <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-300">
                    {displaySuggestions.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* 3. Simple Resume Upload (Fallback & Reference) */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <button
          onClick={() => setShowResumes(!showResumes)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
        >
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Uploaded Resumes ({resumes.length})
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                PDF, DOCX, or plain text (used as fallback if Vault is empty)
              </p>
            </div>
          </div>
          {showResumes ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showResumes && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
            {resumes.length > 0 && (
              <div className="space-y-2">
                {resumes.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">{r.name}</span>
                      {r.is_active === 1 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {r.pdf_filename && (
                        <a
                          href={getResumePdfUrl(r.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <ExternalLink className="w-3 h-3" /> PDF
                        </a>
                      )}
                      {r.is_active !== 1 && (
                        <button
                          onClick={async () => {
                            await activateResume(r.id);
                            setResumes(await fetchResumes());
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold"
                        >
                          Set Active
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          await deleteResume(r.id);
                          setResumes(await fetchResumes());
                        }}
                        className="p-1 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleUploadResume} className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  value={resumeName}
                  onChange={(e) => setResumeName(e.target.value)}
                  placeholder="Resume label (e.g. Data Science CV)"
                  className="border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <textarea
                rows={3}
                value={resumePasteText}
                onChange={(e) => setResumePasteText(e.target.value)}
                placeholder="Or paste plain resume text here if not uploading a file..."
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              {resumeErr && <p className="text-rose-600 dark:text-rose-400">{resumeErr}</p>}
              <button
                type="submit"
                disabled={uploadingResume}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 dark:bg-blue-600 hover:bg-slate-900 dark:hover:bg-blue-500 text-white font-semibold"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingResume ? 'Saving...' : 'Save Resume'}</span>
              </button>
            </form>
          </div>
        )}
      </section>

      {/* Add/Edit Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {editingId ? 'Edit Experience Entry' : 'Add Experience Entry'}
              </h3>
              <button onClick={() => setShowEntryModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Title &amp; Role / Project *</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Backend Internship / Data Quality Project"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Organization / Context</label>
                  <input
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    placeholder="Company, University, or Personal"
                    className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">My Contribution (optional)</label>
                  <input
                    value={roleNote}
                    onChange={(e) => setRoleNote(e.target.value)}
                    placeholder="e.g. Built independently, Co-built with AI"
                    className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Detailed Narrative *</label>
                <textarea
                  required
                  rows={5}
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  placeholder="Describe the problem solved, tools used, metrics, edge cases, and outcomes in full detail..."
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Tags / Skills (autocomplete from JD skills)
                </label>
                <SkillTagInput selectedTags={tags} onChange={setTags} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEntry}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  {savingEntry ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
