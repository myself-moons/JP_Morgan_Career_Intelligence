import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
  Plus,
  Search,
  Settings2,
  Tag,
  X,
} from 'lucide-react';
import {
  addSkillAlias,
  createRoadmapItem,
  fetchRoadmapItems,
  fetchSkillExplorer,
  fetchTaxonomySkills,
} from '../services/api';
import {
  ExplorerSkillItem,
  SkillExplorerResponse,
  TaxonomySkill,
} from '../types';

const ROLE_FILTERS = ['All', 'Family A', 'Family B', 'Family C'];

export const SkillExplorer: React.FC = () => {
  const [data, setData] = useState<SkillExplorerResponse | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<string>('All');
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [showJobPicker, setShowJobPicker] = useState<boolean>(false);
  const [jobSearch, setJobSearch] = useState<string>('');
  const [skillSearch, setSkillSearch] = useState<string>('');
  const [expandedSkillIds, setExpandedSkillIds] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Deduplication state against My Roadmap
  const [inRoadmapNames, setInRoadmapNames] = useState<Set<string>>(new Set());
  const [addingSkillIds, setAddingSkillIds] = useState<Set<number>>(new Set());

  // Quiet Alias Drawer
  const [showAliasDrawer, setShowAliasDrawer] = useState<boolean>(false);
  const [allSkills, setAllSkills] = useState<TaxonomySkill[]>([]);
  const [aliasSkillId, setAliasSkillId] = useState<number>(0);
  const [aliasInput, setAliasInput] = useState<string>('');
  const [aliasMsg, setAliasMsg] = useState<string | null>(null);

  const loadExplorer = async (jobIds: number[], family: string) => {
    try {
      setLoading(true);
      const res = await fetchSkillExplorer({
        job_ids: jobIds.length > 0 ? jobIds : undefined,
        role_family: jobIds.length === 0 && family !== 'All' ? family : undefined,
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoadmapItems()
      .then((items) => {
        setInRoadmapNames(new Set(items.map((i) => i.skill_name.toLowerCase())));
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    loadExplorer(selectedJobIds, selectedFamily);
  }, [selectedFamily, selectedJobIds]);

  const toggleJobSelection = (jobId: number) => {
    setSelectedJobIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const toggleExpandSkill = (skillId: number) => {
    setExpandedSkillIds((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
    );
  };

  const handleQuickAddRoadmap = async (skill: ExplorerSkillItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = skill.canonical_name.toLowerCase();
    if (inRoadmapNames.has(key) || addingSkillIds.has(skill.skill_id)) return;

    setAddingSkillIds((prev) => new Set(prev).add(skill.skill_id));
    try {
      await createRoadmapItem({
        skill_name: skill.canonical_name,
        priority: skill.bucket === 'common_core' ? 'High' : 'Medium',
        status: 'To Learn',
      });
      setInRoadmapNames((prev) => new Set(prev).add(key));
    } finally {
      setAddingSkillIds((prev) => {
        const next = new Set(prev);
        next.delete(skill.skill_id);
        return next;
      });
    }
  };

  const openAliasDrawer = async () => {
    setShowAliasDrawer(true);
    const list = await fetchTaxonomySkills();
    setAllSkills(list);
    if (list.length > 0 && !aliasSkillId) setAliasSkillId(list[0].id);
  };

  const handleSaveAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasSkillId || !aliasInput.trim()) return;
    try {
      const resp = await addSkillAlias(aliasSkillId, aliasInput.trim());
      setAliasMsg(resp.message);
      setAliasInput('');
      loadExplorer(selectedJobIds, selectedFamily);
    } catch (err: any) {
      setAliasMsg(err?.message || 'Could not add alias');
    }
  };

  const filterBySkillSearch = (items: ExplorerSkillItem[]) => {
    const q = skillSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (s) => s.canonical_name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  };

  const matchingJobSuggestions =
    data && jobSearch.trim()
      ? data.available_jobs
        .filter((j) => {
          const q = jobSearch.trim().toLowerCase();
          return (
            j.title.toLowerCase().includes(q) ||
            (j.external_job_id || '').toLowerCase().includes(q) ||
            j.role_family.toLowerCase().includes(q)
          );
        })
        .slice(0, 15)
      : [];

  const renderSkillBucket = (
    title: string,
    subtitle: string,
    items: ExplorerSkillItem[],
    accentClass: string
  ) => {
    const filtered = filterBySkillSearch(items);
    return (
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{title}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${accentClass}`}>
                {filtered.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-5 text-center text-xs text-slate-400">
            None matching in this group.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((skill) => {
              const isExpanded = expandedSkillIds.includes(skill.skill_id);
              const alreadyAdded = inRoadmapNames.has(skill.canonical_name.toLowerCase());
              const isAdding = addingSkillIds.has(skill.skill_id);

              return (
                <div key={skill.skill_id} className="transition">
                  <div
                    onClick={() => toggleExpandSkill(skill.skill_id)}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {skill.canonical_name}
                        </span>
                        <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/70 px-2 py-0.5 rounded-full">
                          {skill.selected_job_count}/{skill.total_selected_jobs} jobs
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {skill.category} &bull; {skill.required_count} Required, {skill.preferred_count} Preferred
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={alreadyAdded || isAdding}
                        onClick={(e) => handleQuickAddRoadmap(skill, e)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition ${alreadyAdded
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 cursor-default'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50'
                          }`}
                      >
                        {alreadyAdded ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        <span>{alreadyAdded ? 'In Roadmap' : isAdding ? '...' : 'Roadmap'}</span>
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-2 bg-slate-50/70 dark:bg-slate-950/50">
                      {skill.evidences.map((ev) => (
                        <div
                          key={`${ev.job_id}-${ev.requirement_type}`}
                          className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {ev.external_job_id ? `[${ev.external_job_id}] ` : ''}
                              {ev.job_title}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${ev.requirement_type === 'Required'
                                  ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                  : 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                }`}
                            >
                              {ev.requirement_type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
                            &ldquo;{ev.evidence_snippet || 'Matched in job description.'}&rdquo;
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-5">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Skill Explorer</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Compare common core vs. role-specific skills across all {data?.available_jobs.length ?? 0} active &amp; synced jobs.
          </p>
        </div>
        <button
          onClick={openAliasDrawer}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Manage Aliases</span>
        </button>
      </div>

      {/* Scope & Search Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {ROLE_FILTERS.map((fam) => (
              <button
                key={fam}
                onClick={() => {
                  setSelectedJobIds([]);
                  setSelectedFamily(fam);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${selectedJobIds.length === 0 && selectedFamily === fam
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                {fam}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                placeholder="Search skills..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              onClick={() => setShowJobPicker(!showJobPicker)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition shrink-0 ${selectedJobIds.length > 0 || showJobPicker
                  ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>
                {selectedJobIds.length > 0 ? `${selectedJobIds.length} Picked` : 'Pick Jobs'}
              </span>
            </button>
          </div>
        </div>

        {/* Search-only Job Picker (No giant scrolling list!) */}
        {showJobPicker && data && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            {selectedJobIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedJobIds.map((jid) => {
                  const job = data.available_jobs.find((j) => j.job_id === jid);
                  if (!job) return null;
                  return (
                    <button
                      key={jid}
                      onClick={() => toggleJobSelection(jid)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-semibold"
                    >
                      <span className="truncate max-w-[200px]">{job.title}</span>
                      <X className="w-3 h-3 shrink-0" />
                    </button>
                  );
                })}
                <button
                  onClick={() => setSelectedJobIds([])}
                  className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline ml-1"
                >
                  Clear all
                </button>
              </div>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder={`Type to search across ${data.available_jobs.length} jobs (title, ID, or family)...`}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800"
              />
            </div>

            {jobSearch.trim() && (
              <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
                {matchingJobSuggestions.length === 0 ? (
                  <span className="text-xs text-slate-400">No jobs match &ldquo;{jobSearch}&rdquo;.</span>
                ) : (
                  matchingJobSuggestions.map((job) => {
                    const picked = selectedJobIds.includes(job.job_id);
                    return (
                      <button
                        key={job.job_id}
                        onClick={() => toggleJobSelection(job.job_id)}
                        className={`text-left px-2.5 py-1.5 rounded-lg text-xs border transition ${picked
                            ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                      >
                        {job.external_job_id ? `${job.external_job_id}: ` : ''}
                        {job.title}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">Comparing selected roles...</div>
      ) : data ? (
        <div className="space-y-4">
          {renderSkillBucket(
            'Common Core Skills',
            `Appear consistently across your ${data.total_selected_jobs} selected role(s)`,
            data.common_core,
            'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
          )}
          {data.total_selected_jobs > 1 &&
            renderSkillBucket(
              'Shared Skills',
              'Requested in at least 2 selected roles',
              data.shared,
              'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300'
            )}
          {data.total_selected_jobs > 1 &&
            renderSkillBucket(
              'Role-Specific Skills',
              'Unique to a single selected role',
              data.role_specific,
              'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            )}
        </div>
      ) : null}

      {/* Quiet Alias Drawer Modal */}
      {showAliasDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl overscroll-contain">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Map Alternate Skill Wording</span>
              </h3>
              <button onClick={() => setShowAliasDrawer(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAlias} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Canonical Skill</label>
                <select
                  value={aliasSkillId}
                  onChange={(e) => setAliasSkillId(Number(e.target.value))}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {allSkills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.canonical_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Alternate Wording / Alias</label>
                <input
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  placeholder="e.g. BigQuery, PySpark, DQ"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              {aliasMsg && <p className="text-emerald-700 dark:text-emerald-300 font-medium">{aliasMsg}</p>}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Save Alias Mapping
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
