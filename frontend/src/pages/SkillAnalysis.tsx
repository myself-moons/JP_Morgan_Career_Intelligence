import React, { useState, useEffect } from 'react';
import {
  FileSearch,
  Sparkles,
  Check,
  X,
  Plus,
  RefreshCw,
  Tag,
  AlertCircle,
  Briefcase,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { Job, TaxonomySkill, JobSkillRecord, DisambiguateResult } from '../types';
import {
  fetchJobs,
  fetchTaxonomySkills,
  fetchJobSkills,
  extractJobSkills,
  batchExtractSkills,
  updateJobSkill,
  createManualJobSkill,
  createCanonicalSkill,
  addSkillAlias,
  disambiguateSkill,
} from '../services/api';

const CATEGORIES = [
  'All',
  'Technical',
  'Governance & Quality',
  'Analytics & AI',
  'Finance & Risk',
  'Core Competency',
];

const REVIEW_STATUSES = ['All', 'Proposed', 'Accepted', 'Rejected', 'Edited'];

export const SkillAnalysis: React.FC = () => {
  const [activeView, setActiveView] = useState<'review' | 'taxonomy'>('review');

  // Job selection & skills
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [jobSkills, setJobSkills] = useState<JobSkillRecord[]>([]);
  const [skillsLoading, setSkillsLoading] = useState<boolean>(false);
  const [extracting, setExtracting] = useState<boolean>(false);
  const [batchExtracting, setBatchExtracting] = useState<boolean>(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedReviewStatus, setSelectedReviewStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Taxonomy view state
  const [taxonomySkills, setTaxonomySkills] = useState<TaxonomySkill[]>([]);
  const [taxLoading, setTaxLoading] = useState<boolean>(false);
  const [taxSearch, setTaxSearch] = useState<string>('');
  const [taxCategory, setTaxCategory] = useState<string>('All');

  // Modals & Tools
  const [isDisambiguateOpen, setIsDisambiguateOpen] = useState<boolean>(false);
  const [disambiguatePhrase, setDisambiguatePhrase] = useState<string>('');
  const [disambiguateContext, setDisambiguateContext] = useState<string>('');
  const [disambiguateResult, setDisambiguateResult] = useState<DisambiguateResult | null>(null);
  const [disambiguating, setDisambiguating] = useState<boolean>(false);

  const [isAddSkillModalOpen, setIsAddSkillModalOpen] = useState<boolean>(false);
  const [newSkillName, setNewSkillName] = useState<string>('');
  const [newSkillCategory, setNewSkillCategory] = useState<string>('Technical');
  const [newSkillDesc, setNewSkillDesc] = useState<string>('');
  const [newSkillAliases, setNewSkillAliases] = useState<string>('');

  const [isAddAliasOpen, setIsAddAliasOpen] = useState<boolean>(false);
  const [aliasTargetSkill, setAliasTargetSkill] = useState<TaxonomySkill | null>(null);
  const [newAliasText, setNewAliasText] = useState<string>('');

  const [isManualJobSkillOpen, setIsManualJobSkillOpen] = useState<boolean>(false);
  const [manualSkillId, setManualSkillId] = useState<number | null>(null);
  const [manualReqType, setManualReqType] = useState<string>('Required');
  const [manualSnippet, setManualSnippet] = useState<string>('');

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // 1. Initial Load of Jobs
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const jobsResp = await fetchJobs();
        const available = jobsResp.jobs.filter((j) => j.status === 'Available');
        setJobs(available);
        if (available.length > 0) {
          setSelectedJobId(available[0].id);
        }
      } catch (err: any) {
        showNotification(err.message || 'Failed to load jobs', 'error');
      }
    };
    loadInitialData();
  }, []);

  // 2. Load Skills for Selected Job
  const loadJobSkills = async (jobId: number) => {
    setSkillsLoading(true);
    try {
      const skills = await fetchJobSkills(jobId);
      setJobSkills(skills);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load job skills', 'error');
    } finally {
      setSkillsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedJobId) {
      loadJobSkills(selectedJobId);
    }
  }, [selectedJobId]);

  // 3. Load Taxonomy Skills
  const loadTaxonomy = async () => {
    setTaxLoading(true);
    try {
      const data = await fetchTaxonomySkills({
        category: taxCategory !== 'All' ? taxCategory : undefined,
        search: taxSearch.trim() || undefined,
      });
      setTaxonomySkills(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load taxonomy', 'error');
    } finally {
      setTaxLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === 'taxonomy') {
      loadTaxonomy();
    }
  }, [activeView, taxCategory, taxSearch]);

  // Handler: Run extraction on current job
  const handleExtractJob = async () => {
    if (!selectedJobId) return;
    setExtracting(true);
    try {
      const extracted = await extractJobSkills(selectedJobId);
      setJobSkills(extracted);
      showNotification(`Extracted ${extracted.length} skills for this role.`);
    } catch (err: any) {
      showNotification(err.message || 'Extraction failed', 'error');
    } finally {
      setExtracting(false);
    }
  };

  // Handler: Batch extract across all jobs
  const handleBatchExtract = async () => {
    setBatchExtracting(true);
    try {
      const res = await batchExtractSkills();
      showNotification(res.message);
      if (selectedJobId) {
        await loadJobSkills(selectedJobId);
      }
    } catch (err: any) {
      showNotification(err.message || 'Batch extraction failed', 'error');
    } finally {
      setBatchExtracting(false);
    }
  };

  // Handler: Update Review Status / Requirement Type
  const handleReviewSkill = async (
    jobSkillId: number,
    updates: { review_status?: string; requirement_type?: string }
  ) => {
    if (!selectedJobId) return;
    try {
      const updated = await updateJobSkill(selectedJobId, jobSkillId, updates);
      setJobSkills((prev) => prev.map((s) => (s.id === jobSkillId ? updated : s)));
      showNotification(`Updated: ${updated.canonical_name} (${updated.review_status})`);
    } catch (err: any) {
      showNotification(err.message || 'Failed to update review status', 'error');
    }
  };

  // Handler: AI Disambiguation
  const handleRunDisambiguate = async () => {
    if (!disambiguatePhrase.trim()) return;
    setDisambiguating(true);
    try {
      const res = await disambiguateSkill(disambiguatePhrase, disambiguateContext);
      setDisambiguateResult(res);
    } catch (err: any) {
      showNotification(err.message || 'Disambiguation failed', 'error');
    } finally {
      setDisambiguating(false);
    }
  };

  // Handler: Create Canonical Skill
  const handleCreateCanonicalSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    try {
      const aliasesList = newSkillAliases
        .split(',')
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean);
      await createCanonicalSkill({
        canonical_name: newSkillName.trim(),
        category: newSkillCategory,
        description: newSkillDesc.trim() || undefined,
        aliases: aliasesList,
      });
      showNotification(`Created canonical skill: ${newSkillName}`);
      setIsAddSkillModalOpen(false);
      setNewSkillName('');
      setNewSkillDesc('');
      setNewSkillAliases('');
      loadTaxonomy();
    } catch (err: any) {
      showNotification(err.message || 'Failed to create skill', 'error');
    }
  };

  // Handler: Add Alias to Skill
  const handleAddAliasSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasTargetSkill || !newAliasText.trim()) return;
    try {
      const res = await addSkillAlias(aliasTargetSkill.id, newAliasText.trim());
      showNotification(res.message);
      setIsAddAliasOpen(false);
      setNewAliasText('');
      setAliasTargetSkill(null);
      loadTaxonomy();
    } catch (err: any) {
      showNotification(err.message || 'Failed to add alias', 'error');
    }
  };

  // Handler: Add Manual Skill to Job
  const handleAddManualJobSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !manualSkillId) return;
    try {
      const res = await createManualJobSkill(selectedJobId, {
        skill_id: manualSkillId,
        requirement_type: manualReqType,
        evidence_snippet: manualSnippet.trim() || undefined,
      });
      setJobSkills((prev) => [res, ...prev.filter((s) => s.skill_id !== manualSkillId)]);
      showNotification(`Added ${res.canonical_name} as ${res.requirement_type} skill.`);
      setIsManualJobSkillOpen(false);
      setManualSnippet('');
    } catch (err: any) {
      showNotification(err.message || 'Failed to add skill', 'error');
    }
  };

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  // Filtered Job Skills
  const filteredJobSkills = jobSkills.filter((s) => {
    if (selectedCategory !== 'All' && s.category !== selectedCategory) return false;
    if (selectedReviewStatus !== 'All' && s.review_status !== selectedReviewStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.canonical_name.toLowerCase().includes(q);
      const matchAlias = s.matched_alias?.toLowerCase().includes(q);
      const matchSnippet = s.evidence_snippet?.toLowerCase().includes(q);
      if (!matchName && !matchAlias && !matchSnippet) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold border transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-800'
              : 'bg-rose-950 text-rose-200 border-rose-800'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-sm">
              <FileSearch className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Skill Taxonomy & Review</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Explore skills identified in JPMorgan Chase job descriptions, approve or correct matches, and view real sentence evidence.
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center p-1 bg-slate-200/80 rounded-xl border border-slate-300/80 self-start">
          <button
            onClick={() => setActiveView('review')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeView === 'review'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Review Role Skills</span>
          </button>
          <button
            onClick={() => setActiveView('taxonomy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeView === 'taxonomy'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Standard Skills Dictionary</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: HUMAN IN THE LOOP JOB SKILL REVIEW */}
      {activeView === 'review' && (
        <div className="space-y-5">
          {/* Top Bar: Job Selector & Batch Actions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1 max-w-2xl">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Target JPMorgan Chase Job:
                </label>
                <div className="relative">
                  <select
                    value={selectedJobId || ''}
                    onChange={(e) => setSelectedJobId(Number(e.target.value))}
                    className="w-full text-xs font-medium pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
                  >
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        [{j.external_job_id || `ID-${j.id}`}] {j.title} ({j.role_family.split(':')[0]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 self-start lg:self-end">
                <button
                  onClick={handleExtractJob}
                  disabled={extracting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  title="Run deterministic extraction on this specific job description"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${extracting ? 'animate-spin' : ''}`} />
                  <span>{extracting ? 'Extracting...' : 'Extract This Job'}</span>
                </button>

                <button
                  onClick={handleBatchExtract}
                  disabled={batchExtracting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  title="Batch extract skills across all available jobs in the library"
                >
                  <Layers className={`w-3.5 h-3.5 ${batchExtracting ? 'animate-spin' : ''}`} />
                  <span>{batchExtracting ? 'Batching...' : 'Scan All Jobs (N=10)'}</span>
                </button>

                <button
                  onClick={() => setIsDisambiguateOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-semibold shadow-sm transition"
                  title="Use Gemini AI to map an ambiguous phrase to a standard skill"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>AI Skill Helper</span>
                </button>

                <button
                  onClick={async () => {
                    await loadTaxonomy();
                    setIsManualJobSkillOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold shadow-sm transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Skill Link</span>
                </button>
              </div>
            </div>

            {/* Selected Job Metadata Summary */}
            {selectedJob && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {selectedJob.external_job_id || `ID-${selectedJob.id}`}
                </span>
                <span className="font-semibold text-slate-700">{selectedJob.title}</span>
                <span>&bull;</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  {selectedJob.role_family.split(':')[0]}
                </span>
                <span>&bull;</span>
                <span>{selectedJob.location}</span>
                {selectedJob.capture_date && (
                  <>
                    <span>&bull;</span>
                    <span>Posted: {selectedJob.capture_date}</span>
                  </>
                )}
                <span>&bull;</span>
                <span className="font-semibold text-slate-700">
                  {jobSkills.length} Total Skills Extracted
                </span>
              </div>
            )}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            {/* Category Pills */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Status & Search */}
            <div className="flex items-center gap-2">
              <select
                value={selectedReviewStatus}
                onChange={(e) => setSelectedReviewStatus(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {REVIEW_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    Review: {st}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Search extracted skills or snippets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 sm:w-56"
              />
            </div>
          </div>

          {/* Extracted Skills List */}
          {skillsLoading ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-3">
              <RefreshCw className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Loading extracted skills for this job...</p>
            </div>
          ) : filteredJobSkills.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-3">
              <FileSearch className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No skills match the selected filters</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {jobSkills.length === 0
                  ? 'Click "Extract This Job" above to run deterministic dictionary matching against this JD.'
                  : 'Try adjusting your category, status, or search query filter.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredJobSkills.map((record) => {
                const isRequired = record.requirement_type === 'Required';
                const statusColor =
                  record.review_status === 'Accepted'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : record.review_status === 'Rejected'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : record.review_status === 'Edited'
                    ? 'bg-purple-100 text-purple-800 border-purple-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300';

                return (
                  <div
                    key={record.id}
                    className={`bg-white rounded-xl border p-4 shadow-xs transition hover:shadow-sm space-y-3 ${
                      record.review_status === 'Rejected'
                        ? 'opacity-60 border-slate-200 bg-slate-50/50'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{record.canonical_name}</h4>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {record.category}
                          </span>
                        </div>
                        {record.matched_alias && record.matched_alias.toLowerCase() !== record.canonical_name.toLowerCase() && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Matched alias: <code className="text-blue-600 font-mono">{record.matched_alias}</code>
                          </p>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Requirement Level Toggle Button */}
                        <button
                          onClick={() =>
                            handleReviewSkill(record.id, {
                              requirement_type: isRequired ? 'Preferred' : 'Required',
                            })
                          }
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                            isRequired
                              ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                              : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                          }`}
                          title="Click to toggle between Required and Preferred"
                        >
                          {record.requirement_type}
                        </button>

                        {/* Review Status Pill */}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${statusColor}`}
                        >
                          {record.review_status}
                        </span>
                      </div>
                    </div>

                    {/* Verbatim Evidence Snippet */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Verbatim Evidence Snippet (FR-03 / FR-11):</span>
                        <span className="text-slate-400 font-mono">{record.confidence}% conf</span>
                      </div>
                      <p className="italic text-slate-600">
                        "{record.evidence_snippet || 'No context snippet recorded.'}"
                      </p>
                    </div>

                    {/* Human Review Action Bar */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400">
                        Method: <strong className="text-slate-600">{record.extraction_method}</strong>
                      </span>

                      <div className="flex items-center gap-1.5">
                        {/* Accept Button */}
                        <button
                          onClick={() => handleReviewSkill(record.id, { review_status: 'Accepted' })}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition flex items-center gap-1 ${
                            record.review_status === 'Accepted'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                          title="Approve extraction (Accept)"
                        >
                          <Check className="w-3 h-3" />
                          <span>Approve</span>
                        </button>

                        {/* Reject Button */}
                        <button
                          onClick={() => handleReviewSkill(record.id, { review_status: 'Rejected' })}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition flex items-center gap-1 ${
                            record.review_status === 'Rejected'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          }`}
                          title="Reject spurious detection"
                        >
                          <X className="w-3 h-3" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: CANONICAL TAXONOMY & ALIAS DICTIONARY */}
      {activeView === 'taxonomy' && (
        <div className="space-y-5">
          {/* Top Bar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Canonical Skill Dictionary</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Standardized skills across Banking, Risk, Governance, and Technology with unique alias mappings (BR-04).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddSkillModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Canonical Skill</span>
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setTaxCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    taxCategory === cat
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search canonical skills or aliases..."
              value={taxSearch}
              onChange={(e) => setTaxSearch(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
            />
          </div>

          {/* Taxonomy Grid */}
          {taxLoading ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-3">
              <RefreshCw className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Loading canonical taxonomy...</p>
            </div>
          ) : taxonomySkills.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-2">
              <Tag className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500">No canonical skills found matching filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {taxonomySkills.map((skill) => (
                <div
                  key={skill.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{skill.canonical_name}</h4>
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 mt-1">
                          {skill.category}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {skill.job_count} Jobs
                      </span>
                    </div>

                    {skill.description && (
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                        {skill.description}
                      </p>
                    )}

                    {/* Aliases List */}
                    <div className="mt-3">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Registered Aliases ({skill.aliases.length}):
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {skill.aliases.map((alias) => (
                          <span
                            key={alias}
                            className="font-mono text-[11px] bg-slate-50 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                          >
                            {alias}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => {
                        setAliasTargetSkill(skill);
                        setIsAddAliasOpen(true);
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Alias</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: AI SEMANTIC DISAMBIGUATION (FR-42, TC-22) */}
      {isDisambiguateOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-purple-50/60">
              <div className="flex items-center gap-2 text-purple-900">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold">AI Semantic Taxonomy Disambiguation (FR-42)</h3>
              </div>
              <button onClick={() => setIsDisambiguateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-500">
                Type or paste an ambiguous or complex skill phrase from a JPMC job description. Gemini Flash will analyze it in context and propose the canonical taxonomy match.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ambiguous Skill Phrase *
                </label>
                <input
                  type="text"
                  placeholder='e.g. "authoring relational database queries and stored procedures"'
                  value={disambiguatePhrase}
                  onChange={(e) => setDisambiguatePhrase(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Surrounding Context (Optional sentence)
                </label>
                <textarea
                  rows={2}
                  placeholder='e.g. "Seeking associate with 3+ years in data extraction pipelines..."'
                  value={disambiguateContext}
                  onChange={(e) => setDisambiguateContext(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleRunDisambiguate}
                  disabled={disambiguating || !disambiguatePhrase.trim()}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${disambiguating ? 'animate-spin' : ''}`} />
                  <span>{disambiguating ? 'Analyzing with AI...' : 'Suggest Canonical Mapping'}</span>
                </button>
              </div>

              {/* Result Popover */}
              {disambiguateResult && (
                <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                      Proposed Canonical Match:
                    </span>
                    <span className="text-[10px] font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded-full">
                      {disambiguateResult.confidence}% confidence
                    </span>
                  </div>

                  <div className="text-sm font-black text-purple-950">
                    {disambiguateResult.suggested_canonical_name}
                  </div>

                  <p className="text-slate-600 text-xs leading-relaxed">
                    <strong>Rationale:</strong> {disambiguateResult.rationale}
                  </p>

                  <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between">
                    <span className="text-[11px] text-purple-700 font-medium">
                      Mode: {disambiguateResult.is_llm_powered ? 'Gemini 1.5 Flash' : 'Offline Token Fallback'}
                    </span>
                    {disambiguateResult.suggested_skill_id && (
                      <button
                        onClick={async () => {
                          try {
                            await addSkillAlias(
                              disambiguateResult.suggested_skill_id!,
                              disambiguatePhrase.trim().toLowerCase()
                            );
                            showNotification(
                              `Mapped "${disambiguatePhrase}" as approved alias to ${disambiguateResult.suggested_canonical_name}!`
                            );
                            setIsDisambiguateOpen(false);
                            setDisambiguateResult(null);
                            setDisambiguatePhrase('');
                          } catch (err: any) {
                            showNotification(err.message, 'error');
                          }
                        }}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold shadow-xs transition"
                      >
                        Map as Official Alias (BR-04)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD CANONICAL SKILL */}
      {isAddSkillModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Add New Canonical Skill</h3>
              <button onClick={() => setIsAddSkillModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCanonicalSkill} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Canonical Skill Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Snowflake"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                <select
                  value={newSkillCategory}
                  onChange={(e) => setNewSkillCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of enterprise capability..."
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Initial Aliases (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. snowflake db, snowpark, snowflake data cloud"
                  value={newSkillAliases}
                  onChange={(e) => setNewSkillAliases(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddSkillModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow-xs"
                >
                  Save Canonical Skill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD ALIAS TO SKILL */}
      {isAddAliasOpen && aliasTargetSkill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                Add Alias to "{aliasTargetSkill.canonical_name}"
              </h3>
              <button onClick={() => setIsAddAliasOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAliasSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alias / Synonym Phrase *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. postgres, psql"
                  value={newAliasText}
                  onChange={(e) => setNewAliasText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Aliases must be unique and will map all mentions directly to {aliasTargetSkill.canonical_name} (BR-04).
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddAliasOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow-xs"
                >
                  Save Alias
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD MANUAL JOB SKILL */}
      {isManualJobSkillOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Add Skill Link to Current Job</h3>
              <button onClick={() => setIsManualJobSkillOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddManualJobSkill} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Canonical Skill *</label>
                <select
                  required
                  value={manualSkillId || ''}
                  onChange={(e) => setManualSkillId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose a skill --</option>
                  {taxonomySkills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.canonical_name} ({s.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Requirement Level *</label>
                <select
                  value={manualReqType}
                  onChange={(e) => setManualReqType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Required">Required</option>
                  <option value="Preferred">Preferred</option>
                  <option value="Unspecified">Unspecified</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Evidence Sentence / Snippet</label>
                <textarea
                  rows={2}
                  placeholder="Sentence from JD or manual justification..."
                  value={manualSnippet}
                  onChange={(e) => setManualSnippet(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsManualJobSkillOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!manualSkillId}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50"
                >
                  Add Skill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
