import React, { useState, useEffect } from 'react';
import { Job, JobListResponse } from '../types';
import {
  fetchJobs,
  createJob,
  uploadJobDocument,
  deleteJob,
  seedBaselineJobs,
} from '../services/api';
import {
  Briefcase,
  Plus,
  Search,
  Upload,
  FileCheck,
  AlertCircle,
  Eye,
  Trash2,
  RefreshCw,
  X,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

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
  const [copied, setCopied] = useState<boolean>(false);

  // Form State
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formReqId, setFormReqId] = useState<string>('');
  const [formLocation, setFormLocation] = useState<string>('Goregaon, Mumbai');
  const [formFamily, setFormFamily] = useState<string>(ROLE_FAMILIES[0]);
  const [formStatus, setFormStatus] = useState<string>('Available');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formContextNote, setFormContextNote] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Upload State
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [uploadFileInfo, setUploadFileInfo] = useState<{
    filename: string;
    charCount: number;
    lineCount: number;
  } | null>(null);

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
      if (!formTitle) {
        // Strip file extension as a title suggestion
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setFormTitle(cleanName);
      }
    } catch (err: any) {
      setFormError(err?.message || 'File upload failed');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formTitle.trim()) {
      setFormError('Job title is required.');
      return;
    }

    if (formStatus !== 'JD unavailable' && !formDescription.trim()) {
      setFormError("Job description text is required unless status is 'JD unavailable'.");
      return;
    }

    setSubmitting(true);
    try {
      await createJob({
        title: formTitle.trim(),
        company_name: 'JPMorgan Chase',
        external_job_id: formReqId.trim() || undefined,
        location: formLocation.trim(),
        role_family: formFamily,
        status: formStatus,
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
    if (!window.confirm('Re-seed all 11 baseline JPMorgan Chase jobs from research document?')) {
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
    setFormReqId('');
    setFormLocation('Goregaon, Mumbai');
    setFormFamily(ROLE_FAMILIES[0]);
    setFormStatus('Available');
    setFormDescription('');
    setFormContextNote('');
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
    if (status.toLowerCase() === 'jd unavailable') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
          JD unavailable
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900">Job Library</h2>
            {data && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                {data.total_count} Listings ({data.analysable_count} Active JDs)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            JPMorgan Chase target roles categorized into Role Families A, B, and C with immutable original descriptions.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleReSeed}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium shadow-sm transition"
            title="Re-seed 11 baseline jobs from research dataset"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Re-seed Baseline</span>
          </button>

          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition"
          >
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles, requisition IDs, locations..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedFamily}
            onChange={(e) => setSelectedFamily(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Role Families</option>
            <option value="Family A">Family A: Data Management, Quality & Governance</option>
            <option value="Family B">Family B: Analytics, Automation & AI</option>
            <option value="Family C">Family C: Finance, Credit & Operations</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Statuses</option>
            <option value="Available">Available (Analysable)</option>
            <option value="JD unavailable">JD unavailable</option>
          </select>
        </div>
      </div>

      {/* Table Listing */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <RefreshCw className="w-5 h-5 mx-auto animate-spin text-blue-500 mb-2" />
            Loading job listings...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs">
            <AlertCircle className="w-5 h-5 mx-auto mb-2 text-rose-500" />
            {error}
          </div>
        ) : !data || data.jobs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No job listings found matching your search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Job / Requisition</th>
                  <th className="py-3 px-4">Role Family</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Capture Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{job.title}</div>
                      <div className="text-[11px] text-slate-500 flex items-center space-x-2 mt-0.5">
                        <span className="font-mono text-blue-600">{job.external_job_id || `ID-${job.id}`}</span>
                        <span>&bull;</span>
                        <span>{job.company_name}</span>
                      </div>
                      {job.context_note && (
                        <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                          {job.context_note}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${getFamilyBadgeColor(
                          job.role_family
                        )}`}
                      >
                        {job.role_family.split(':')[0]}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{job.location}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(job.status)}</td>
                    <td className="py-3.5 px-4 text-slate-500">{job.capture_date}</td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                        title="View Full Job Description"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                      <button
                        onClick={() => handleDeleteJob(job.id, job.title)}
                        className="inline-flex items-center p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                        title="Delete Job"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Add New Job Listing</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-b border-slate-200 bg-slate-100 px-6 pt-2 flex space-x-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('paste')}
                className={`pb-2 border-b-2 transition ${
                  activeTab === 'paste'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                1. Paste Text (FR-01)
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`pb-2 border-b-2 transition ${
                  activeTab === 'upload'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                2. Upload Document (PDF / DOCX) (FR-02)
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {activeTab === 'upload' && (
                <div className="p-4 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 text-center space-y-2">
                  <Upload className="w-8 h-8 text-blue-500 mx-auto" />
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
                      Extracting document text...
                    </div>
                  )}
                  {uploadFileInfo && (
                    <div className="mt-2 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded p-2 flex items-center justify-between">
                      <span className="font-medium flex items-center space-x-1">
                        <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{uploadFileInfo.filename}</span>
                      </span>
                      <span>
                        {uploadFileInfo.charCount} characters, {uploadFileInfo.lineCount} lines
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Lead Data Engineer"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Requisition ID / Code
                  </label>
                  <input
                    type="text"
                    value={formReqId}
                    onChange={(e) => setFormReqId(e.target.value)}
                    placeholder="e.g. JPMC-REQ-99"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role Family *
                  </label>
                  <select
                    value={formFamily}
                    onChange={(e) => setFormFamily(e.target.value)}
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Job Description Text {formStatus !== 'JD unavailable' ? '*' : '(Optional for JD unavailable)'}
                </label>
                <textarea
                  rows={8}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Paste verbatim job description text here..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  disabled={formStatus === 'JD unavailable'}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
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

      {/* View Job Drawer / Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedJob.title}</h3>
                <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-mono text-blue-600 font-semibold">
                    {selectedJob.external_job_id || `ID-${selectedJob.id}`}
                  </span>
                  <span>&bull;</span>
                  <span>{selectedJob.location}</span>
                  <span>&bull;</span>
                  <span>{selectedJob.role_family}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div className="space-y-0.5">
                  <div className="text-slate-500">Status: {getStatusBadge(selectedJob.status)}</div>
                  {selectedJob.context_note && (
                    <div className="text-slate-600 italic">
                      <span className="font-semibold not-italic">Note:</span> {selectedJob.context_note}
                    </div>
                  )}
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

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Original Immutable Description (FR-03)
                </h4>
                {selectedJob.original_description ? (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto">
                    {selectedJob.original_description}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-rose-200 bg-rose-50/50 text-center text-xs text-rose-700">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-400" />
                    Full description text was unavailable at time of capture. Preserved as placeholder metadata and excluded from frequency denominators.
                  </div>
                )}
              </div>
            </div>

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
    </div>
  );
};
