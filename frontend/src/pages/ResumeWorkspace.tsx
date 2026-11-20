import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  ExternalLink,
  Download,
  Save,
  RefreshCw,
  Upload,
  AlertCircle,
  Code2,
  Eye,
  Columns,
  Sparkles,
  Briefcase,
  Award,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';
import { ResumeDocument, Job, ExplainableMatch } from '../types';
import {
  fetchResumes,
  activateResume,
  updateResumeLatex,
  getResumePdfUrl,
  getResumeTexUrl,
  uploadResumeFile,
  fetchJobs,
  evaluateResumeAgainstJob,
  fetchCachedJobMatch,
} from '../services/api';

export const ResumeWorkspace: React.FC = () => {
  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [latexCode, setLatexCode] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View mode: 'split' | 'pdf' | 'latex'
  const [viewMode, setViewMode] = useState<'split' | 'pdf' | 'latex'>('split');

  // Target Job matching preview
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [explainableMatch, setExplainableMatch] = useState<ExplainableMatch | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [isCheckingCache, setIsCheckingCache] = useState<boolean>(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [copiedRecIdx, setCopiedRecIdx] = useState<number | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadName, setUploadName] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const runEvaluation = async (jobId: number, forceRefresh: boolean = false) => {
    if (!selectedResumeId || !jobId) return;
    try {
      setIsEvaluating(true);
      setEvalError(null);
      const evalData = await evaluateResumeAgainstJob(selectedResumeId, jobId, forceRefresh);
      setExplainableMatch(evalData);
    } catch (err: any) {
      setEvalError(err?.message || 'Failed to evaluate job match');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleJobSelect = async (jobId: number | null) => {
    setSelectedJobId(jobId);
    setExplainableMatch(null);
    setEvalError(null);
    if (jobId && selectedResumeId) {
      try {
        setIsCheckingCache(true);
        const cached = await fetchCachedJobMatch(selectedResumeId, jobId);
        if (cached) {
          setExplainableMatch(cached);
        }
      } catch {
        // No cache found, user can trigger evaluation manually
      } finally {
        setIsCheckingCache(false);
      }
    }
  };

  const handleCopyRecommendation = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedRecIdx(idx);
    setTimeout(() => setCopiedRecIdx(null), 2500);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [resumesData, jobsData] = await Promise.all([
        fetchResumes(),
        fetchJobs({ status: 'All' })
      ]);
      setResumes(resumesData);
      setJobs(jobsData.jobs);

      if (resumesData.length > 0) {
        const active = resumesData.find(r => r.is_active === 1) || resumesData[0];
        setSelectedResumeId(active.id);
        setLatexCode(active.latex_source || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resumes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedResume = resumes.find(r => r.id === selectedResumeId) || null;

  const handleSelectResume = async (resumeId: number) => {
    if (hasUnsavedChanges) {
      const confirmDiscard = window.confirm(
        'You have unsaved LaTeX changes. Switch resume anyway?'
      );
      if (!confirmDiscard) return;
    }
    setSelectedResumeId(resumeId);
    const target = resumes.find(r => r.id === resumeId);
    if (target) {
      setLatexCode(target.latex_source || '');
      setHasUnsavedChanges(false);
      setSaveSuccess(false);
    }

    // Check local cache for newly selected resume with existing selected job
    setExplainableMatch(null);
    setEvalError(null);
    if (selectedJobId) {
      try {
        setIsCheckingCache(true);
        const cached = await fetchCachedJobMatch(resumeId, selectedJobId);
        if (cached) {
          setExplainableMatch(cached);
        }
      } catch {
        // No cached evaluation
      } finally {
        setIsCheckingCache(false);
      }
    }
  };

  const handleActivate = async () => {
    if (!selectedResumeId) return;
    try {
      const updated = await activateResume(selectedResumeId);
      setResumes(prev =>
        prev.map(r => ({
          ...r,
          is_active: r.id === updated.id ? 1 : 0
        }))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Activation failed');
    }
  };

  const handleSaveLatex = async () => {
    if (!selectedResumeId) return;
    try {
      setIsSaving(true);
      const updated = await updateResumeLatex(selectedResumeId, latexCode);
      setResumes(prev =>
        prev.map(r => (r.id === updated.id ? { ...r, latex_source: latexCode, raw_text: updated.raw_text } : r))
      );
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save LaTeX');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenOverleaf = () => {
    navigator.clipboard.writeText(latexCode);
    alert('LaTeX source code copied to clipboard! You can paste it into a new Overleaf project.');
    window.open('https://www.overleaf.com/docs', '_blank');
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadName.trim() || !uploadFile) return;

    try {
      setIsUploading(true);
      const newResume = await uploadResumeFile(uploadName.trim(), uploadFile);
      setResumes(prev => [newResume, ...prev]);
      setSelectedResumeId(newResume.id);
      setLatexCode(newResume.latex_source || '');
      setShowUploadModal(false);
      setUploadName('');
      setUploadFile(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const targetJob = jobs.find(j => j.id === selectedJobId) || null;

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="text-cyan-400" size={26} />
            Resume Intelligence & LaTeX Workspace
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage multiple resume versions, preview live PDFs, and personalize LaTeX source directly for target JPMorgan Chase roles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            title="Reload Resumes"
            className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition"
          >
            <Upload size={16} />
            Add Resume
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800 text-red-200 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle size={20} className="shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Resume Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">
            Selected Resume:
          </span>
          <select
            value={selectedResumeId || ''}
            onChange={e => handleSelectResume(Number(e.target.value))}
            className="bg-slate-950 text-white text-sm font-medium px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-500"
          >
            {resumes.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} {r.is_active === 1 ? '★ (Active Matcher)' : ''}
              </option>
            ))}
          </select>

          {selectedResume?.is_active === 1 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 size={13} /> Active Profile Resume
            </span>
          ) : (
            <button
              onClick={handleActivate}
              className="text-xs px-3 py-1.5 bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/40 rounded-lg transition"
            >
              Set as Active
            </button>
          )}
        </div>

        {/* View Switcher & Action Tools */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center">
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === 'split' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
            >
              <Columns size={14} /> Split
            </button>
            <button
              onClick={() => setViewMode('pdf')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === 'pdf' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
            >
              <Eye size={14} /> PDF
            </button>
            <button
              onClick={() => setViewMode('latex')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === 'latex' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
            >
              <Code2 size={14} /> LaTeX
            </button>
          </div>

          {selectedResume && (
            <div className="flex items-center gap-1">
              <a
                href={getResumeTexUrl(selectedResume.id)}
                download
                title="Download .tex Source"
                className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
              >
                <Download size={16} />
              </a>
              <button
                onClick={handleOpenOverleaf}
                title="Open in Overleaf (Copy & Open)"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg transition"
              >
                <ExternalLink size={14} />
                <span>Overleaf</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace Layout */}
      {selectedResume ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* PDF Preview Frame */}
          {(viewMode === 'split' || viewMode === 'pdf') && (
            <div
              className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col ${viewMode === 'pdf' ? 'lg:col-span-2' : ''
                }`}
              style={{ height: '740px' }}
            >
              <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-2 font-medium text-slate-300">
                  <Eye size={15} className="text-cyan-400" />
                  PDF Preview: {selectedResume.pdf_filename || `${selectedResume.name}.pdf`}
                </span>
                <a
                  href={getResumePdfUrl(selectedResume.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-cyan-300 flex items-center gap-1 transition"
                >
                  <ExternalLink size={13} /> Open External
                </a>
              </div>
              <div className="flex-1 bg-slate-950 relative">
                {selectedResume.pdf_filename ? (
                  <iframe
                    src={getResumePdfUrl(selectedResume.id)}
                    title={selectedResume.name}
                    className="w-full h-full border-0 bg-white"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                    <FileText size={48} className="mb-3 opacity-40" />
                    <p className="text-base font-semibold text-slate-400">No PDF Compiled Yet</p>
                    <p className="text-xs max-w-sm mt-1">
                      Edit the LaTeX source on the right, export it or copy it into Overleaf to compile your updated PDF.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LaTeX Editor Pane */}
          {(viewMode === 'split' || viewMode === 'latex') && (
            <div
              className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col ${viewMode === 'latex' ? 'lg:col-span-2' : ''
                }`}
              style={{ height: '740px' }}
            >
              <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-300 font-medium">
                  <Code2 size={15} className="text-cyan-400" />
                  <span>LaTeX Source Code</span>
                  {hasUnsavedChanges && (
                    <span className="text-amber-400 text-xs italic font-normal">● Unsaved edits</span>
                  )}
                  {saveSuccess && (
                    <span className="text-emerald-400 text-xs font-semibold">✓ Saved!</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs">
                    {latexCode.split('\n').length} lines
                  </span>
                  <button
                    onClick={handleSaveLatex}
                    disabled={isSaving || !hasUnsavedChanges}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition ${hasUnsavedChanges
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                  >
                    <Save size={13} />
                    <span>{isSaving ? 'Saving...' : 'Save Source'}</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-slate-950 p-3 font-mono text-xs overflow-hidden flex flex-col">
                <textarea
                  value={latexCode}
                  onChange={e => {
                    setLatexCode(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="% Enter or paste LaTeX resume code here..."
                  className="w-full flex-1 bg-transparent text-slate-200 resize-none focus:outline-none leading-relaxed font-mono selection:bg-cyan-700 selection:text-white"
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
          <FileText size={48} className="mx-auto mb-4 text-slate-600" />
          <h3 className="text-lg font-semibold text-white">No Resumes Found</h3>
          <p className="text-sm mt-1 max-w-md mx-auto">
            Place your <code className="text-cyan-400">.tex</code> or <code className="text-cyan-400">.pdf</code> resumes in the <code className="text-cyan-400">resumes/</code> folder or upload one above.
          </p>
        </div>
      )}

      {/* Target Job Personalization & Keyword Coverage */}
      {selectedResume && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Briefcase className="text-cyan-400" size={20} />
              <h2 className="text-base font-semibold text-white">
                Personalize & Verify Against Target JPMC Job
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Select Job Listing:</span>
              <select
                value={selectedJobId || ''}
                onChange={e => handleJobSelect(Number(e.target.value) || null)}
                className="bg-slate-950 text-white text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-500"
              >
                <option value="">-- Choose Target JPMC Role --</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>
                    [{j.external_job_id || `ID ${j.id}`}] {j.title} ({j.role_family.split(':')[0]})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {targetJob ? (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-cyan-400 font-bold text-xs bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                      {targetJob.external_job_id || `ID-${targetJob.id}`}
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      {targetJob.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    {targetJob.role_family} • Location: <span className="text-slate-300">{targetJob.location}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {explainableMatch && (
                    <button
                      onClick={() => selectedJobId && runEvaluation(selectedJobId, true)}
                      disabled={isEvaluating}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition disabled:opacity-60"
                      title="Force a fresh evaluation with Gemini AI"
                    >
                      <Sparkles size={14} className={isEvaluating ? 'animate-spin' : ''} />
                      <span>{isEvaluating ? 'Evaluating with AI...' : 'Re-Analyze with Gemini AI'}</span>
                    </button>
                  )}
                </div>
              </div>

              {evalError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{evalError}</span>
                </div>
              )}

              {isCheckingCache && (
                <div className="p-6 text-center bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <RefreshCw size={20} className="mx-auto text-cyan-400 animate-spin" />
                  <p className="text-xs text-slate-400">Checking local cache for existing evaluation (0 API calls)...</p>
                </div>
              )}

              {isEvaluating && (
                <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <Sparkles size={28} className="mx-auto text-cyan-400 animate-bounce" />
                  <p className="text-xs font-semibold text-slate-300">
                    Running Explainable AI Bar Raiser Evaluation...
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Analyzing qualifications, technical stack, and domain governance fit against JPMorgan Chase standards.
                  </p>
                </div>
              )}

              {!explainableMatch && !isEvaluating && !isCheckingCache && (
                <div className="p-8 text-center bg-slate-950/80 border border-dashed border-slate-800 rounded-xl space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-cyan-950/50 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">No AI Assessment Generated Yet</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                      To protect your Google AI Studio free tier quota, evaluations are only run on-demand and cached locally in SQLite.
                    </p>
                  </div>
                  <button
                    onClick={() => selectedJobId && runEvaluation(selectedJobId, false)}
                    disabled={isEvaluating}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold shadow-lg transition"
                  >
                    <Sparkles size={14} />
                    <span>Run Explainable AI Assessment</span>
                  </button>
                </div>
              )}

              {explainableMatch && !isEvaluating && (
                <div className="space-y-4">
                  {/* Score & Verdict Banner */}
                  <div className="p-4 bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Hiring Bar Verdict:
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${explainableMatch.overall_score >= 80
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : explainableMatch.overall_score >= 60
                                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                : explainableMatch.overall_score >= 40
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}
                        >
                          {explainableMatch.readiness_verdict}
                        </span>
                        {explainableMatch.is_cached ? (
                          <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 flex items-center gap-1 font-semibold">
                            <CheckCircle2 size={11} /> Saved in SQLite Cache (0 API Calls)
                          </span>
                        ) : explainableMatch.is_llm_powered ? (
                          <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 flex items-center gap-1 font-semibold">
                            <Sparkles size={11} /> Fresh Gemini Evaluation (Cached)
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">
                            Curated Taxonomy
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                        {explainableMatch.summary_reasoning}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 font-medium">Match Fit Score</span>
                        <div className="text-2xl font-black text-cyan-400">
                          {explainableMatch.overall_score}%
                        </div>
                      </div>
                      <div className="w-20 bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-500 ${explainableMatch.overall_score >= 80
                              ? 'bg-emerald-500'
                              : explainableMatch.overall_score >= 60
                                ? 'bg-cyan-500'
                                : 'bg-amber-500'
                            }`}
                          style={{ width: `${explainableMatch.overall_score}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3 Dimensional Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.entries(explainableMatch.dimensions).map(([key, dim]) => {
                      const title =
                        key === 'technical_skills'
                          ? 'Technical & Stack Alignment'
                          : key === 'domain_knowledge'
                            ? 'Banking & Governance Domain'
                            : 'Experience Scope & Seniority';
                      return (
                        <div
                          key={key}
                          className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-300">{title}</span>
                            <span className="text-xs font-bold text-cyan-400">{dim.score}%</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {dim.reasoning}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Matched vs Missing Genuine Skills */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-xl space-y-2">
                      <div className="font-semibold text-emerald-400 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} />
                          <span>Verified Matched Competencies</span>
                        </span>
                        <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full">
                          {explainableMatch.verified_matched_skills.length} Skills
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {explainableMatch.verified_matched_skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2.5 py-1 bg-emerald-500/15 text-emerald-300 rounded-md border border-emerald-500/30 font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-xl space-y-2">
                      <div className="font-semibold text-amber-400 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle size={14} />
                          <span>Critical Gaps to Address</span>
                        </span>
                        <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full">
                          {explainableMatch.critical_missing_skills.length} Gaps
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {explainableMatch.critical_missing_skills.map((gap) => (
                          <span
                            key={gap}
                            className="px-2.5 py-1 bg-amber-500/15 text-amber-300 rounded-md border border-amber-500/30 font-medium"
                          >
                            {gap}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actionable LaTeX Recommendations */}
                  {explainableMatch.actionable_latex_recommendations.length > 0 && (
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                        <Award size={15} className="text-cyan-400" />
                        <span>Actionable Resume Adjustments for In-App LaTeX Editor</span>
                      </div>
                      <div className="space-y-2">
                        {explainableMatch.actionable_latex_recommendations.map((rec, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="flex items-start gap-2 text-slate-300 leading-relaxed">
                              <span className="text-cyan-400 font-bold">{idx + 1}.</span>
                              <span>{rec}</span>
                            </div>
                            <button
                              onClick={() => handleCopyRecommendation(rec, idx)}
                              className="text-slate-400 hover:text-white p-1 shrink-0 rounded transition"
                              title="Copy to clipboard"
                            >
                              {copiedRecIdx === idx ? (
                                <Check size={14} className="text-emerald-400" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              Select a job listing from the dropdown to run an Explainable AI assessment and see targeted recommendations.
            </p>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Upload className="text-cyan-400" size={20} />
              Add Resume Document
            </h3>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Resume Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  placeholder="e.g. Manthan Senior Fintech Resume"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  File (.pdf or .tex) *
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.tex"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow transition"
                >
                  {isUploading ? 'Uploading...' : 'Save & Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
