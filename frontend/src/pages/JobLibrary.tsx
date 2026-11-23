import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Search,
  Plus,
  RotateCcw,
  FileText,
  Check,
  Copy,
  ExternalLink,
  AlertCircle,
  Trash2,
  Upload,
  X,
  FileCheck,
  AlertTriangle,
  Sparkles,
  ListChecks,
  GraduationCap,
  Star,
  Eye,
  Globe,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  fetchJobs,
  createJob,
  updateJob,
  deleteJob,
  seedBaselineJobs,
  uploadJobDocument,
  fetchNextJobCode,
  parseRawText,
  syncJpmcJobs,
} from '../services/api';
import { Job, JobListResponse, SyncResult } from '../types';

const ROLE_FAMILIES = [
  'Family A: Data Management, Quality and Governance',
  'Family B: Analytics, Automation and AI',
  'Family C: Finance, Credit and Operations',
];

export const JobLibrary: React.FC = () => {
  const [data, setData] = useState<JobListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedFamily, setSelectedFamily] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [detailTab, setDetailTab] = useState<'structured' | 'original'>('structured');
  const [copied, setCopied] = useState<boolean>(false);

  // Form State
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('upload');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formCompany, setFormCompany] = useState<string>('JPMorgan Chase');
  const [formReqId, setFormReqId] = useState<string>('');
  const [formLocation, setFormLocation] = useState<string>('Goregaon, Mumbai');
  const [formFamily, setFormFamily] = useState<string>(ROLE_FAMILIES[0]);
  const [formStatus, setFormStatus] = useState<string>('Available');
  const [formSummary, setFormSummary] = useState<string>('');
  const [formResponsibilities, setFormResponsibilities] = useState<string>('');
  const [formQualifications, setFormQualifications] = useState<string>('');
  const [formPreferred, setFormPreferred] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formContextNote, setFormContextNote] = useState<string>('');
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const [showOriginalInModal, setShowOriginalInModal] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [parsingText, setParsingText] = useState<boolean>(false);

  // Upload State
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [uploadFileInfo, setUploadFileInfo] = useState<{
    filename: string;
    charCount: number;
    lineCount: number;
  } | null>(null);

  // Sync Modal State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [syncLimit, setSyncLimit] = useState<number>(25);
  const [syncDryRun, setSyncDryRun] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handlePromoteToAvailable = async (jobId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await updateJob(jobId, { status: 'Available' });
      await loadJobs();
      if (selectedJob && selectedJob.id === jobId) {
        setSelectedJob(prev => (prev ? { ...prev, status: 'Available' } : null));
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to promote job');
    }
  };

  const handleRunSync = async () => {
    try {
      setIsSyncing(true);
      setSyncError(null);
      setSyncResult(null);
      const res = await syncJpmcJobs(syncLimit, syncDryRun);
      setSyncResult(res);
      await loadJobs();
    } catch (err: any) {
      setSyncError(err?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const loadJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchJobs({
        role_family: selectedFamily !== 'All' ? selectedFamily : undefined,
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        search: search.trim() ? search.trim() : undefined,
      });
      setData(response);
    } catch (err: any) {
      setError(err?.message || 'Failed to load job listings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadJobs();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, selectedFamily, selectedStatus]);

  const openAddModal = async () => {
    resetForm();
    setIsAddModalOpen(true);
    try {
      const nextCode = await fetchNextJobCode();
      setFormReqId(nextCode);
    } catch {
      setFormReqId('JB-1');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    setFormError(null);
    try {
      const result = await uploadJobDocument(file);
      setFormDescription(result.extracted_text);
      setUploadFileInfo({
        filename: result.filename,
        charCount: result.char_count,
        lineCount: result.line_count,
      });

      // Auto-populate all fields from intelligent extraction
      const fields = result.parsed_fields;
      if (fields.title) setFormTitle(fields.title);
      if (fields.company_name) setFormCompany(fields.company_name);
      if (fields.location) setFormLocation(fields.location);
      if (fields.role_family) setFormFamily(fields.role_family);
      if (fields.status) setFormStatus(fields.status);
      if (fields.summary) setFormSummary(fields.summary);
      if (fields.responsibilities) setFormResponsibilities(fields.responsibilities);
      if (fields.qualifications) setFormQualifications(fields.qualifications);
      if (fields.preferred_qualifications) setFormPreferred(fields.preferred_qualifications);

      // Set Requisition ID: use suggested auto-increment code (e.g. JB-1)
      if (result.suggested_code) {
        setFormReqId(result.suggested_code);
      }

      setFieldWarnings(fields.warnings || {});
    } catch (err: any) {
      setFormError(err?.message || 'File upload failed');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleAutoExtractFromPaste = async () => {
    if (!formDescription.trim()) {
      setFormError('Please paste some job description text first to extract fields.');
      return;
    }
    setParsingText(true);
    setFormError(null);
    try {
      const fields = await parseRawText(formDescription);
      if (fields.title) setFormTitle(fields.title);
      if (fields.company_name) setFormCompany(fields.company_name);
      if (fields.location) setFormLocation(fields.location);
      if (fields.role_family) setFormFamily(fields.role_family);
      if (fields.status) setFormStatus(fields.status);
      if (fields.summary) setFormSummary(fields.summary);
      if (fields.responsibilities) setFormResponsibilities(fields.responsibilities);
      if (fields.qualifications) setFormQualifications(fields.qualifications);
      if (fields.preferred_qualifications) setFormPreferred(fields.preferred_qualifications);
      setFieldWarnings(fields.warnings || {});
    } catch (err: any) {
      setFormError(err?.message || 'Failed to auto-extract fields from text');
    } finally {
      setParsingText(false);
    }
  };

  const clearWarning = (field: string) => {
    if (fieldWarnings[field]) {
      setFieldWarnings((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formTitle.trim()) {
      setFormError('Job title is required.');
      return;
    }

    const hasDesc = formDescription.trim() || formResponsibilities.trim() || formQualifications.trim();
    if (formStatus !== 'JD unavailable' && !hasDesc) {
      setFormError("Job description text or responsibilities/qualifications are required unless status is 'JD unavailable'.");
      return;
    }

    setSubmitting(true);
    try {
      await createJob({
        title: formTitle.trim(),
        company_name: formCompany.trim() || 'JPMorgan Chase',
        external_job_id: formReqId.trim() || undefined,
        location: formLocation.trim(),
        role_family: formFamily,
        status: formStatus,
        summary: formSummary.trim() || undefined,
        responsibilities: formResponsibilities.trim() || undefined,
        qualifications: formQualifications.trim() || undefined,
        preferred_qualifications: formPreferred.trim() || undefined,
        original_description: formDescription.trim() || undefined,
        context_note: formContextNote.trim() || undefined,
      });
      setIsAddModalOpen(false);
      resetForm();
      loadJobs();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteJob = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete job record #${id}: "${title}"?`)) {
      return;
    }
    try {
      await deleteJob(id);
      if (selectedJob?.id === id) {
        setSelectedJob(null);
      }
      loadJobs();
    } catch (err: any) {
      alert(`Error deleting job: ${err?.message}`);
    }
  };

  const handleReSeed = async () => {
    if (!window.confirm('Re-seed all 11 baseline JPMorgan Chase jobs with structured sections from research document?')) {
      return;
    }
    setLoading(true);
    try {
      await seedBaselineJobs();
      await loadJobs();
    } catch (err: any) {
      alert(`Error seeding baseline jobs: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormCompany('JPMorgan Chase');
    setFormReqId('');
    setFormLocation('Goregaon, Mumbai');
    setFormFamily(ROLE_FAMILIES[0]);
    setFormStatus('Available');
    setFormSummary('');
    setFormResponsibilities('');
    setFormQualifications('');
    setFormPreferred('');
    setFormDescription('');
    setFormContextNote('');
    setFieldWarnings({});
    setShowOriginalInModal(false);
    setFormError(null);
    setUploadFileInfo(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFamilyBadgeColor = (family: string) => {
    if (family.includes('Family A')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (family.includes('Family B')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (family.includes('Family C')) return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getStatusBadge = (status: string) => {
    if (status.toLowerCase() === 'available') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
          Available
        </span>
      );
    }
    if (status.toLowerCase() === 'discovered') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5"></span>
          Discovered
        </span>
      );
    }
    if (status.toLowerCase() === 'stale') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
          Stale
        </span>
      );
    }
    if (status.toLowerCase() === 'jd unavailable') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
          JD unavailable
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
        {status}
      </span>
    );
  };

  // Split lines into clean bullet points for human-readable display
  const renderBulletList = (text: string | null | undefined, fallbackMsg: string) => {
    if (!text || !text.trim()) {
      return (
        <div className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-slate-200">
          {fallbackMsg}
        </div>
      );
    }
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    return (
      <ul className="space-y-2">
        {lines.map((line, idx) => {
          const cleanLine = line.replace(/^[-*•\d.]+\s*/, '');
          return (
            <li key={idx} className="flex items-start space-x-2.5 text-xs text-slate-700 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
              <span>{cleanLine}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Job Description Library</h2>
          <p className="text-xs text-slate-500 mt-1">
            Local repository of ingested JPMorgan Chase postings, automated section extraction, and immutable reference text.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium transition shadow-sm"
            title="Sync live job listings directly from JPMorgan Chase careers API"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Sync from JPMC</span>
          </button>
          <button
            onClick={handleReSeed}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition shadow-sm"
            title="Re-populate the 11 baseline JPMorgan Chase jobs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Baseline (11 Jobs)</span>
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Job</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by job title, requisition code, or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={selectedFamily}
              onChange={(e) => setSelectedFamily(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="All">All Role Families</option>
              {ROLE_FAMILIES.map((fam) => (
                <option key={fam} value={fam}>
                  {fam}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Discovered">Discovered (Live Sync)</option>
              <option value="JD unavailable">JD unavailable</option>
              <option value="Stale">Stale (Vanished)</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Collection Metric Bar */}
        {data && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Total Listings: <strong className="text-slate-800">{data.total_count}</strong>
            </span>
            <span>&bull;</span>
            <span>
              Analysable Pool ($N$): <strong className="text-slate-800">{data.analysable_count}</strong>
            </span>
            <span>&bull;</span>
            <span className="text-slate-400">
              Excluded from analysis: {data.total_count - data.analysable_count}
            </span>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && !data ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading job descriptions...</div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-600 bg-rose-50/50">
            <AlertCircle className="w-5 h-5 mx-auto mb-1 text-rose-500" />
            {error}
          </div>
        ) : !data || data.jobs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p>No job listings found matching the specified filters.</p>
            <button
              onClick={handleReSeed}
              className="text-blue-600 hover:underline font-semibold"
            >
              Seed 11 baseline jobs
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Job Title & Requisition ID</th>
                  <th className="py-3 px-4">Role Family</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sections</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-slate-50/80 transition cursor-pointer group"
                    onClick={() => {
                      setSelectedJob(job);
                      setDetailTab('structured');
                    }}
                  >
                    <td className="py-3 px-4 text-center font-mono text-slate-400">
                      {job.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition">
                        {job.title}
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono bg-slate-100 px-1 rounded text-slate-600 font-medium">
                          {job.external_job_id || `ID-${job.id}`}
                        </span>
                        <span>&bull;</span>
                        <span>{job.company_name}</span>
                        {job.capture_date && (
                          <>
                            <span>&bull;</span>
                            <span className="text-slate-500 font-medium">Posted: {job.capture_date}</span>
                          </>
                        )}
                        {job.context_note && (
                          <>
                            <span>&bull;</span>
                            <span className="truncate max-w-xs italic text-slate-500" title={job.context_note}>
                              {job.context_note}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${getFamilyBadgeColor(
                          job.role_family
                        )}`}
                      >
                        {job.role_family.split(':')[0]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{job.location}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(job.status)}
                        {job.status === 'Discovered' && (
                          <button
                            onClick={(e) => handlePromoteToAvailable(job.id, e)}
                            title="Promote to Available (include in N=10 analysis pool)"
                            className="px-1.5 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded font-medium transition"
                          >
                            Promote
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {job.responsibilities || job.qualifications ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Structured</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Raw text</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setSelectedJob(job);
                          setDetailTab('structured');
                        }}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 mr-1 transition"
                        title="View Structured Job Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteJob(job.id, job.title)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete listing"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Job Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add New Job Listing</h3>
                  <p className="text-[11px] text-slate-500">Auto-extract metadata & structured sections from doc or text</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode selection tabs */}
            <div className="border-b border-slate-200 bg-slate-100 px-6 pt-2 flex space-x-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('upload')}
                className={`pb-2 border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'upload'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>1. Upload Document (PDF / DOCX)</span>
              </button>
              <button
                onClick={() => setActiveTab('paste')}
                className={`pb-2 border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'paste'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>2. Paste Raw Text</span>
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Upload Dropzone */}
              {activeTab === 'upload' && (
                <div className="p-4 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 text-center space-y-2">
                  <Upload className="w-7 h-7 text-blue-500 mx-auto" />
                  <div className="text-xs text-slate-600">
                    <label className="text-blue-600 font-semibold cursor-pointer hover:underline">
                      Click to choose a file
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>{' '}
                    or drag & drop
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Supports text-based PDF, DOCX, and TXT files
                  </div>
                  {uploadLoading && (
                    <div className="text-xs text-blue-600 animate-pulse font-medium">
                      Extracting & analyzing document sections...
                    </div>
                  )}
                  {uploadFileInfo && (
                    <div className="mt-2 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded p-2 flex items-center justify-between">
                      <span className="font-medium flex items-center space-x-1.5">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        <span>{uploadFileInfo.filename}</span>
                      </span>
                      <span className="text-emerald-700 font-mono">
                        {uploadFileInfo.charCount} characters, {uploadFileInfo.lineCount} lines
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Paste Text Tab Input */}
              {activeTab === 'paste' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      Raw Job Description Text
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoExtractFromPaste}
                      disabled={parsingText || !formDescription.trim()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{parsingText ? 'Extracting...' : 'Auto-Extract Sections & Fields'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Paste verbatim job description text here, then click 'Auto-Extract'..."
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              )}

              {/* Metadata Fields with Warnings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Job Title *</label>
                    {fieldWarnings.title && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded cursor-help"
                        title={fieldWarnings.title}
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span>Please verify</span>
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => {
                      setFormTitle(e.target.value);
                      clearWarning('title');
                    }}
                    placeholder="e.g. Full Stack Software Developer"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                  {fieldWarnings.title && (
                    <p className="text-[11px] text-amber-600 mt-0.5">⚠️ {fieldWarnings.title}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Requisition ID / Code</label>
                    <span className="text-[11px] text-blue-600 font-mono bg-blue-50 px-1.5 py-0.2 rounded">
                      Auto-incremented
                    </span>
                  </div>
                  <input
                    type="text"
                    value={formReqId}
                    onChange={(e) => setFormReqId(e.target.value)}
                    placeholder="e.g. JB-1"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Simple numerical format (JB-1, JB-2, etc.)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Role Family *</label>
                    {fieldWarnings.role_family && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                        title={fieldWarnings.role_family}
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span>Inferred</span>
                      </span>
                    )}
                  </div>
                  <select
                    value={formFamily}
                    onChange={(e) => {
                      setFormFamily(e.target.value);
                      clearWarning('role_family');
                    }}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    {ROLE_FAMILIES.map((fam) => (
                      <option key={fam} value={fam}>
                        {fam}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="Available">Available</option>
                    <option value="JD unavailable">JD unavailable</option>
                    <option value="Stale">Stale</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Location</label>
                    {fieldWarnings.location && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                        title={fieldWarnings.location}
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span>Defaulted</span>
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => {
                      setFormLocation(e.target.value);
                      clearWarning('location');
                    }}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Structured Sections */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4 text-blue-600" />
                    <span>Extracted Human-Readable Sections</span>
                  </h4>
                  {formDescription && (
                    <button
                      type="button"
                      onClick={() => setShowOriginalInModal(!showOriginalInModal)}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{showOriginalInModal ? 'Hide Original Text' : 'View Full Original Text'}</span>
                    </button>
                  )}
                </div>

                {/* Optional side-by-side view of Original Text */}
                {showOriginalInModal && (
                  <div className="p-3 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono max-h-48 overflow-y-auto leading-relaxed border border-slate-700">
                    <div className="flex items-center justify-between pb-1 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
                      <span>Original Immutable Text Reference</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(formDescription)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-[11px]">{formDescription}</pre>
                  </div>
                )}

                {/* Section 1: Responsibilities */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <ListChecks className="w-3.5 h-3.5 text-blue-500" />
                      <span>Job Responsibilities</span>
                    </label>
                    {fieldWarnings.responsibilities && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                        title={fieldWarnings.responsibilities}
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span>Section not found</span>
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={4}
                    value={formResponsibilities}
                    onChange={(e) => {
                      setFormResponsibilities(e.target.value);
                      clearWarning('responsibilities');
                    }}
                    placeholder="- List key responsibilities or duties here..."
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  {fieldWarnings.responsibilities && (
                    <p className="text-[11px] text-amber-600 mt-0.5">⚠️ {fieldWarnings.responsibilities}</p>
                  )}
                </div>

                {/* Section 2: Required Qualifications */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Job Qualifications (Required)</span>
                    </label>
                    {fieldWarnings.qualifications && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                        title={fieldWarnings.qualifications}
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span>Section not found</span>
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={4}
                    value={formQualifications}
                    onChange={(e) => {
                      setFormQualifications(e.target.value);
                      clearWarning('qualifications');
                    }}
                    placeholder="- List required skills, degree, and years of experience..."
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  {fieldWarnings.qualifications && (
                    <p className="text-[11px] text-amber-600 mt-0.5">⚠️ {fieldWarnings.qualifications}</p>
                  )}
                </div>

                {/* Section 3: Preferred Qualifications */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      <span>Preferred Qualifications / Skills (Optional)</span>
                    </label>
                    {fieldWarnings.preferred_qualifications && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                        title={fieldWarnings.preferred_qualifications}
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span>Not found in doc</span>
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={formPreferred}
                    onChange={(e) => {
                      setFormPreferred(e.target.value);
                      clearWarning('preferred_qualifications');
                    }}
                    placeholder="- List nice-to-have or bonus qualifications..."
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Section 4: Summary / About the Role */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    About Role / Summary (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={formSummary}
                    onChange={(e) => setFormSummary(e.target.value)}
                    placeholder="Brief intro narrative or team mission..."
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Context Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Context / Annotation Note
                </label>
                <input
                  type="text"
                  value={formContextNote}
                  onChange={(e) => setFormContextNote(e.target.value)}
                  placeholder="e.g. Sales CDO initiative, mentions Alteryx and Collibra"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Job Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Human-Readable View Job Drawer / Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedJob.title}</h3>
                <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-mono text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                    {selectedJob.external_job_id || `ID-${selectedJob.id}`}
                  </span>
                  <span>&bull;</span>
                  <span>{selectedJob.company_name}</span>
                  <span>&bull;</span>
                  <span>{selectedJob.location}</span>
                  {selectedJob.capture_date && (
                    <>
                      <span>&bull;</span>
                      <span className="text-slate-700 font-semibold">Posted: {selectedJob.capture_date}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode Tabs */}
            <div className="border-b border-slate-200 bg-slate-100 px-6 pt-2 flex space-x-4 text-xs font-semibold">
              <button
                onClick={() => setDetailTab('structured')}
                className={`pb-2 border-b-2 transition flex items-center gap-1.5 ${
                  detailTab === 'structured'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>Structured Sections (Human Readable)</span>
              </button>
              <button
                onClick={() => setDetailTab('original')}
                className={`pb-2 border-b-2 transition flex items-center gap-1.5 ${
                  detailTab === 'original'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Original Verbatim Text (FR-03 / Audit)</span>
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Metadata Pill */}
              <div className="flex flex-wrap items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span>Status:</span>
                    {getStatusBadge(selectedJob.status)}
                    {selectedJob.status === 'Discovered' && (
                      <button
                        onClick={() => handlePromoteToAvailable(selectedJob.id)}
                        className="px-2 py-0.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition shadow-sm"
                      >
                        Promote to Available
                      </button>
                    )}
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${getFamilyBadgeColor(
                      selectedJob.role_family
                    )}`}
                  >
                    {selectedJob.role_family}
                  </span>
                </div>
                {selectedJob.original_description && (
                  <button
                    onClick={() => copyToClipboard(selectedJob.original_description!)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs shadow-sm transition"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Original Text</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {selectedJob.context_note && (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900">
                  <span className="font-semibold">Context Note:</span> {selectedJob.context_note}
                </div>
              )}

              {/* Tab 1: Human-Readable Structured Sections */}
              {detailTab === 'structured' && (
                <div className="space-y-4">
                  {/* Summary */}
                  {selectedJob.summary && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        About the Role / Summary
                      </h4>
                      <p className="text-xs text-slate-800 leading-relaxed">{selectedJob.summary}</p>
                    </div>
                  )}

                  {/* Responsibilities */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4 text-blue-600" />
                      <span>Job Responsibilities</span>
                    </h4>
                    {renderBulletList(
                      selectedJob.responsibilities,
                      'No specific responsibilities section extracted. Refer to Original Verbatim Text.'
                    )}
                  </div>

                  {/* Required Qualifications */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-indigo-600" />
                      <span>Required Qualifications, Capabilities & Skills</span>
                    </h4>
                    {renderBulletList(
                      selectedJob.qualifications,
                      'No specific required qualifications section extracted. Refer to Original Verbatim Text.'
                    )}
                  </div>

                  {/* Preferred Qualifications */}
                  {selectedJob.preferred_qualifications && (
                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Star className="w-4 h-4 text-amber-500" />
                        <span>Preferred Qualifications & Capabilities</span>
                      </h4>
                      {renderBulletList(selectedJob.preferred_qualifications, '')}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Original Verbatim Immutable Text */}
              {detailTab === 'original' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold uppercase tracking-wider">
                      Immutable Captured Source Text (FR-01 / FR-03)
                    </span>
                    <span>
                      {selectedJob.original_description ? `${selectedJob.original_description.length} characters` : '0 characters'}
                    </span>
                  </div>

                  {selectedJob.original_description ? (
                    <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-[55vh] overflow-y-auto border border-slate-800">
                      {selectedJob.original_description}
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl border border-dashed border-rose-200 bg-rose-50/50 text-center text-xs text-rose-700">
                      <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-400" />
                      Full description text was unavailable at time of capture. Preserved as placeholder metadata and excluded from frequency denominators.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <a
                href="http://127.0.0.1:8080"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline inline-flex items-center space-x-1"
              >
                <span>Inspect in SQLite Console (FR-41)</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JPMC Oracle Cloud Live Sync Modal */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Sync from JPMorgan Chase Careers</h3>
                  <p className="text-xs text-slate-500">Live JSON ingestion from Oracle Recruiting Cloud (CX_1001)</p>
                </div>
              </div>
              <button
                onClick={() => setIsSyncModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-600">
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1.5 text-indigo-900">
                <div className="font-semibold flex items-center gap-1.5 text-indigo-800">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>Oracle Cloud Recruiting Endpoints</span>
                </div>
                <p className="text-[11px] leading-relaxed text-indigo-700">
                  Directly queries JPMC's candidate experience API for Goregaon and Mumbai postings. New listings enter with status <code className="bg-white px-1 py-0.5 rounded border font-semibold">Discovered</code>, preserving your analysable baseline ($N=10$) until you review and promote them.
                </p>
              </div>

              {syncError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{syncError}</span>
                </div>
              )}

              {syncResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="font-bold text-emerald-800 flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Sync Completed Successfully</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center pt-1">
                    <div className="p-2 bg-white rounded-lg border border-emerald-100">
                      <div className="text-base font-bold text-indigo-600">{syncResult.added}</div>
                      <div className="text-[10px] text-slate-500">Discovered</div>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-emerald-100">
                      <div className="text-base font-bold text-blue-600">{syncResult.updated}</div>
                      <div className="text-[10px] text-slate-500">Backfilled</div>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-emerald-100">
                      <div className="text-base font-bold text-slate-600">{syncResult.unchanged}</div>
                      <div className="text-[10px] text-slate-500">Unchanged</div>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-emerald-100">
                      <div className="text-base font-bold text-amber-600">{syncResult.stale}</div>
                      <div className="text-[10px] text-slate-500">Stale</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-700 italic">{syncResult.message}</p>
                </div>
              )}

              {!syncResult && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Max Job Requisitions to Query:
                    </label>
                    <select
                      value={syncLimit}
                      onChange={(e) => setSyncLimit(Number(e.target.value))}
                      className="w-full py-2 px-3 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={10}>10 Requisitions</option>
                      <option value={25}>25 Requisitions (Default Page)</option>
                      <option value={50}>50 Requisitions</option>
                      <option value={100}>100 Requisitions</option>
                    </select>
                  </div>

                  <label className="flex items-center space-x-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={syncDryRun}
                      onChange={(e) => setSyncDryRun(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-700 font-medium">
                      Dry Run Mode (simulate sync without saving changes to local database)
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleRunSync}
                disabled={isSyncing}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing from JPMC...' : syncResult ? 'Sync Again' : 'Start Live Sync'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
