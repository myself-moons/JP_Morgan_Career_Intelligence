import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  GraduationCap,
  Info,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  createLearningResource,
  deleteLearningResource,
  fetchJobs,
  fetchLearningRecommendations,
  fetchLearningResources,
  getExportLearningUrl,
  updateLearningProgress,
} from '../services/api';
import {
  Job,
  LearningRecommendationsResponse,
  LearningResource,
} from '../types';

const PROGRESS_OPTIONS = ['Not started', 'In progress', 'Completed', 'Paused'] as const;
const COST_OPTIONS = ['All', 'Free', 'Freemium', 'Paid', 'Unknown'] as const;

export const LearningTracker: React.FC = () => {
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [recs, setRecs] = useState<LearningRecommendationsResponse | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | undefined>(undefined);

  const [costFilter, setCostFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [policyNotice, setPolicyNotice] = useState<string | null>(null);

  // Add Custom Resource Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newProvider, setNewProvider] = useState<string>('');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newUrl, setNewUrl] = useState<string>('');
  const [newSkills, setNewSkills] = useState<string>('');
  const [newCost, setNewCost] = useState<string>('Unknown');
  const [newDuration, setNewDuration] = useState<string>('');
  const [newCert, setNewCert] = useState<boolean>(false);
  const [newDesc, setNewDesc] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [resData, recData, jobsData] = await Promise.all([
        fetchLearningResources({
          cost_status: costFilter !== 'All' ? costFilter : undefined,
          progress_status: statusFilter !== 'All' ? statusFilter : undefined,
          search: search.trim() || undefined,
        }),
        fetchLearningRecommendations(selectedJobId),
        fetchJobs({ status: 'Available' }),
      ]);
      setResources(resData);
      setRecs(recData);
      setJobs(jobsData.jobs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [costFilter, statusFilter, selectedJobId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLearningResources({
        cost_status: costFilter !== 'All' ? costFilter : undefined,
        progress_status: statusFilter !== 'All' ? statusFilter : undefined,
        search: search.trim() || undefined,
      }).then(setResources);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  const handleStatusChange = async (resourceId: number, status: string, notes?: string) => {
    const resp = await updateLearningProgress(resourceId, { status, notes });
    setPolicyNotice(resp.policy_notice);
    setResources((prev) => prev.map((r) => (r.id === resourceId ? resp.resource : r)));
    if (recs) {
      const updatedRecs = await fetchLearningRecommendations(selectedJobId);
      setRecs(updatedRecs);
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvider.trim() || !newTitle.trim()) return;
    await createLearningResource({
      provider: newProvider.trim(),
      title: newTitle.trim(),
      url: newUrl.trim() || undefined,
      skills_addressed: newSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      cost_status: newCost,
      has_certificate: newCert,
      duration: newDuration.trim() || undefined,
      description: newDesc.trim() || undefined,
    });
    setShowAddModal(false);
    setNewProvider('');
    setNewTitle('');
    setNewUrl('');
    setNewSkills('');
    setNewCost('Unknown');
    setNewDuration('');
    setNewCert(false);
    setNewDesc('');
    loadData();
  };

  const handleDeleteCustom = async (id: number) => {
    if (!window.confirm('Delete this custom learning resource?')) return;
    await deleteLearningResource(id);
    loadData();
  };

  const getCostBadge = (cost: string) => {
    if (cost === 'Free') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (cost === 'Freemium') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (cost === 'Paid') return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-amber-50 text-amber-800 border-amber-200';
  };

  const getProgressStyle = (status: string) => {
    if (status === 'Completed') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (status === 'In progress') return 'bg-blue-100 text-blue-800 border-blue-300';
    if (status === 'Paused') return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Learning Intelligence &amp; Gap Tracker</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Courses and simulations matched to the exact skills missing from your profile. Finishing a course records study progress without inflating hands-on skill proof.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={getExportLearningUrl('csv')}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </a>
          <a
            href={getExportLearningUrl('xlsx')}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </a>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Course</span>
          </button>
        </div>
      </div>

      {/* BR-09 Policy Banner */}
      {policyNotice && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{policyNotice}</span>
          </div>
          <button onClick={() => setPolicyNotice(null)} className="text-blue-500 hover:text-blue-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Priority Gap Recommendations Section */}
      {recs && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Recommended Courses for Your Top Skill Gaps</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Top missing/unverified skills across {recs.analysable_jobs_count} JPMorgan roles:{' '}
                <strong className="text-slate-700">
                  {recs.priority_gap_skills.slice(0, 5).join(', ') || 'None — great coverage!'}
                </strong>
              </p>
            </div>

            <select
              value={selectedJobId || ''}
              onChange={(e) => setSelectedJobId(e.target.value ? Number(e.target.value) : undefined)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="">All Active JPMC Roles ({recs.analysable_jobs_count})</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  Focus on: {j.title}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recs.recommendations.slice(0, 6).map((rec) => (
              <div
                key={rec.resource.id}
                className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 hover:bg-white transition flex flex-col justify-between space-y-2.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                      {rec.resource.provider}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getCostBadge(
                        rec.resource.cost_status
                      )}`}
                    >
                      {rec.resource.cost_status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 leading-snug">{rec.resource.title}</h4>
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1 mt-2 font-medium">
                    {rec.gap_reason}
                  </p>
                  {rec.pricing_warning && (
                    <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{rec.pricing_warning}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/70">
                  <select
                    value={rec.resource.progress_status}
                    onChange={(e) => handleStatusChange(rec.resource.id, e.target.value)}
                    className={`text-[11px] font-semibold px-2 py-1 rounded border ${getProgressStyle(
                      rec.resource.progress_status
                    )}`}
                  >
                    {PROGRESS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {rec.resource.url && (
                    <a
                      href={rec.resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Learning Catalogue & Study Tracker */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Full Learning Catalogue ({resources.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search skill, course, provider..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 bg-white w-52"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            </div>

            <select
              value={costFilter}
              onChange={(e) => setCostFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              {COST_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  Cost: {c}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="All">Status: All</option>
              {PROGRESS_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading learning catalogue...</div>
        ) : resources.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No learning resources match the active filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {resources.map((res) => (
              <div
                key={res.id}
                className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/60"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {res.provider}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{res.title}</h4>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getCostBadge(
                        res.cost_status
                      )}`}
                    >
                      {res.cost_status}
                    </span>
                    {res.has_certificate && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Certificate
                      </span>
                    )}
                  </div>

                  {res.description && <p className="text-xs text-slate-600">{res.description}</p>}

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      Skills: <strong className="text-slate-700">{res.skills_addressed.join(', ')}</strong>
                    </span>
                    {res.duration && (
                      <span className="flex items-center gap-1">
                        &bull; <Clock className="w-3 h-3" /> {res.duration}
                      </span>
                    )}
                    <span>&bull; Verified: {res.verification_date}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select
                    value={res.progress_status}
                    onChange={(e) => handleStatusChange(res.id, e.target.value, res.notes || undefined)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${getProgressStyle(
                      res.progress_status
                    )}`}
                  >
                    {PROGRESS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>

                  {res.progress_status === 'Completed' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Study Done
                    </span>
                  )}

                  {res.url && (
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <span>Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {res.is_custom && (
                    <button
                      onClick={() => handleDeleteCustom(res.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700"
                      title="Delete custom course"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Custom Resource Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add Learning Resource</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddResource} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Provider *</label>
                  <input
                    required
                    value={newProvider}
                    onChange={(e) => setNewProvider(e.target.value)}
                    placeholder="Coursera, edX, Official Docs"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cost Status (BR-11)</label>
                  <select
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="Free">Free</option>
                    <option value="Freemium">Freemium</option>
                    <option value="Paid">Paid</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Course / Guide Title *</label>
                <input
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Data Lineage & Governance Bootcamp"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Skills Covered (comma-separated)</label>
                <input
                  value={newSkills}
                  onChange={(e) => setNewSkills(e.target.value)}
                  placeholder="Collibra, Data Lineage, SQL"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Course URL</label>
                  <input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Duration</label>
                  <input
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    placeholder="e.g. 8 hours"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={newCert}
                  onChange={(e) => setNewCert(e.target.checked)}
                />
                <span>Includes Certificate of Completion</span>
              </label>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  Add to Catalogue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
