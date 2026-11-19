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
  Briefcase
} from 'lucide-react';
import { ResumeDocument, Job } from '../types';
import {
  fetchResumes,
  activateResume,
  updateResumeLatex,
  getResumePdfUrl,
  getResumeTexUrl,
  uploadResumeFile,
  fetchJobs
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

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadName, setUploadName] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

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

  const handleSelectResume = (resumeId: number) => {
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

  // Simple keyword matching for target job vs current resume
  const targetJob = jobs.find(j => j.id === selectedJobId) || null;
  const resumeText = (selectedResume?.raw_text || '').toLowerCase();

  const getJobKeywordStats = () => {
    if (!targetJob) return null;
    const reqText = `${targetJob.responsibilities || ''} ${targetJob.qualifications || ''} ${targetJob.preferred_qualifications || ''}`;
    // Extract keywords
    const terms = Array.from(
      new Set(
        (reqText.match(/\b[A-Za-z0-9+#.]{3,20}\b/g) || [])
          .map(w => w.trim().toLowerCase())
          .filter(w => !['the', 'and', 'for', 'with', 'that', 'this', 'have', 'from', 'your', 'will', 'role', 'team'].includes(w))
      )
    ).slice(0, 30);

    const matched = terms.filter(t => resumeText.includes(t));
    const missing = terms.filter(t => !resumeText.includes(t));
    const score = terms.length > 0 ? Math.round((matched.length / terms.length) * 100) : 0;

    return { matched, missing, score };
  };

  const matchStats = getJobKeywordStats();

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
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                viewMode === 'split' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns size={14} /> Split
            </button>
            <button
              onClick={() => setViewMode('pdf')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                viewMode === 'pdf' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye size={14} /> PDF
            </button>
            <button
              onClick={() => setViewMode('latex')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                viewMode === 'latex' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
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
              className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col ${
                viewMode === 'pdf' ? 'lg:col-span-2' : ''
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
              className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col ${
                viewMode === 'latex' ? 'lg:col-span-2' : ''
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
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition ${
                      hasUnsavedChanges
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
                onChange={e => setSelectedJobId(Number(e.target.value) || null)}
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

          {targetJob && matchStats ? (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {targetJob.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {targetJob.role_family} • Status: <span className="text-cyan-300 font-medium">{targetJob.status}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Keyword Alignment:</span>
                    <div className="text-lg font-bold text-cyan-400">{matchStats.score}%</div>
                  </div>
                  <div className="w-24 bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-cyan-500 h-2.5 rounded-full"
                      style={{ width: `${matchStats.score}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-lg">
                  <div className="font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>Keywords Found in Active Resume ({matchStats.matched.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {matchStats.matched.map(kw => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-lg">
                  <div className="font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                    <Sparkles size={14} />
                    <span>Potential Keywords to Emphasize in LaTeX ({matchStats.missing.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {matchStats.missing.slice(0, 15).map(kw => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              Select a job listing from the dropdown to compare keyword alignment and see bullet points to tune in LaTeX.
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
