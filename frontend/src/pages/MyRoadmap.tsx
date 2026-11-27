import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  Link2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  createRoadmapItem,
  createSavedResource,
  deleteRoadmapItem,
  deleteSavedResource,
  fetchJobs,
  fetchRoadmapItems,
  fetchSavedResources,
  reviewRoadmapWithAI,
  updateRoadmapItem,
} from '../services/api';
import {
  Job,
  RoadmapItem,
  RoadmapReviewResponse,
  SavedResource,
} from '../types';
import { SkillTagInput } from '../components/SkillTagInput';

const STATUS_OPTIONS = ['To Learn', 'In Progress', 'Done'] as const;
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'] as const;
const RESOURCE_TYPES = ['Course', 'Certification', 'Docs', 'Video', 'Article', 'Other'] as const;

export const MyRoadmap: React.FC = () => {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [resources, setResources] = useState<SavedResource[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add Goal Modal
  const [showAddGoal, setShowAddGoal] = useState<boolean>(false);
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [goalNote, setGoalNote] = useState<string>('');
  const [priority, setPriority] = useState<string>('Medium');

  // Add Link Modal
  const [showAddLink, setShowAddLink] = useState<boolean>(false);
  const [resTitle, setResTitle] = useState<string>('');
  const [resUrl, setResUrl] = useState<string>('');
  const [resType, setResType] = useState<string>('Course');
  const [resSkillTags, setResSkillTags] = useState<string[]>([]);
  const [resNotes, setResNotes] = useState<string>('');

  // Optional AI Roadmap Review
  const [review, setReview] = useState<RoadmapReviewResponse | null>(null);
  const [reviewing, setReviewing] = useState<boolean>(false);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [rmData, resData, jobsData] = await Promise.all([
        fetchRoadmapItems(),
        fetchSavedResources(),
        fetchJobs({ status: 'All' }),
      ]);
      setItems(rmData);
      setResources(resData);
      setJobs(jobsData.jobs.filter((j) => j.status !== 'JD unavailable'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (skillTags.length === 0) return;
    await createRoadmapItem({
      skill_name: skillTags[0],
      goal_note: goalNote.trim() || undefined,
      priority,
      status: 'To Learn',
    });
    setSkillTags([]);
    setGoalNote('');
    setPriority('Medium');
    setShowAddGoal(false);
    setItems(await fetchRoadmapItems());
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resUrl.trim()) return;
    await createSavedResource({
      title: resTitle.trim(),
      url: resUrl.trim(),
      resource_type: resType,
      skill_name: resSkillTags[0],
      notes: resNotes.trim() || undefined,
    });
    setResTitle('');
    setResUrl('');
    setResType('Course');
    setResSkillTags([]);
    setResNotes('');
    setShowAddLink(false);
    setResources(await fetchSavedResources());
  };

  const handleReviewAI = async (forceRefresh: boolean = false) => {
    try {
      setReviewing(true);
      const res = await reviewRoadmapWithAI({
        job_ids: jobs.map((j) => j.id),
        model_mode: 'flash',
        force_refresh: forceRefresh,
      });
      setReview(res);
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">My Roadmap</h2>
          <p className="text-xs text-slate-500">
            Track the skills you decide to learn and save your own courses, certifications, or notes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleReviewAI(false)}
            disabled={reviewing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{reviewing ? 'Reviewing...' : 'Review with AI'}</span>
          </button>
          <button
            onClick={() => setShowAddLink(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Save Link</span>
          </button>
          <button
            onClick={() => setShowAddGoal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Add Skill</span>
          </button>
        </div>
      </div>

      {/* Optional AI Review Card */}
      {review && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-900">AI Roadmap Feedback</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                {review.model_used}
              </span>
              {review.is_cached && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                  Cached
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReviewAI(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh AI</span>
              </button>
              <button onClick={() => setReview(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-700">{review.summary}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {review.missing_common_skills.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <strong className="block text-amber-900 mb-1">Missing Common Skills</strong>
                <ul className="list-disc list-inside text-amber-800 space-y-0.5">
                  {review.missing_common_skills.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {review.niche_or_low_priority.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <strong className="block text-slate-800 mb-1">Niche / Optional Items</strong>
                <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                  {review.niche_or_low_priority.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {review.project_ideas.length > 0 && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <strong className="block text-emerald-900 mb-1">Suggested Mini-Projects</strong>
                <ul className="list-disc list-inside text-emerald-800 space-y-0.5">
                  {review.project_ideas.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Roadmap Items */}
      <section className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
            Loading your roadmap...
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
            <p className="text-xs sm:text-sm text-slate-600">
              Your roadmap is empty. Add skills from Explorer or click &ldquo;Add Skill&rdquo;.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{item.skill_name}</span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${item.priority === 'High'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : item.priority === 'Low'
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                  >
                    {item.priority}
                  </span>
                </div>
                {item.goal_note && <p className="text-xs text-slate-600">{item.goal_note}</p>}
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                <select
                  value={item.status}
                  onChange={async (e) => {
                    const updated = await updateRoadmapItem(item.id, { status: e.target.value });
                    setItems((prev) => prev.map((x) => (x.id === item.id ? updated : x)));
                  }}
                  className="text-xs font-semibold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                >
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    await deleteRoadmapItem(item.id);
                    setItems((prev) => prev.filter((x) => x.id !== item.id));
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* Personal Saved Resources & Certifications */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Saved Links &amp; Certifications ({resources.length})
          </h3>
        </div>
        {resources.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No saved links yet. Paste any course, certification, doc, or article URL you want to keep.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {resources.map((r) => (
              <div key={r.id} className="p-4 flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {r.resource_type}
                    </span>
                    {r.skill_name && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        {r.skill_name}
                      </span>
                    )}
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs sm:text-sm font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      <span>{r.title}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  {r.notes && <p className="text-xs text-slate-600">{r.notes}</p>}
                </div>
                <button
                  onClick={async () => {
                    await deleteSavedResource(r.id);
                    setResources((prev) => prev.filter((x) => x.id !== r.id));
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Roadmap Skill Modal */}
      {showAddGoal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Add Skill to Roadmap</h3>
              <button onClick={() => setShowAddGoal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddGoal} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Short Skill Name *</label>
                <SkillTagInput
                  selectedTags={skillTags}
                  onChange={setSkillTags}
                  singleMode
                  placeholder="Type canonical skill (e.g. Collibra, SQL)..."
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Optional Short Goal Note</label>
                <input
                  value={goalNote}
                  onChange={(e) => setGoalNote(e.target.value)}
                  placeholder="e.g. Glossary & Lineage basics"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={
                  skillTags.length === 0 ||
                  items.some((i) => i.skill_name.toLowerCase() === skillTags[0].toLowerCase())
                }
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold"
              >
                {skillTags[0] &&
                  items.some((i) => i.skill_name.toLowerCase() === skillTags[0].toLowerCase())
                  ? 'Already in Roadmap'
                  : 'Add to Roadmap'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Save Resource Link Modal */}
      {showAddLink && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Save Course or Certification URL</h3>
              <button onClick={() => setShowAddLink(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddResource} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Title *</label>
                <input
                  required
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  placeholder="e.g. PostgreSQL Window Functions Guide"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">URL *</label>
                <input
                  required
                  type="url"
                  value={resUrl}
                  onChange={(e) => setResUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Type</label>
                  <select
                    value={resType}
                    onChange={(e) => setResType(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    {RESOURCE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Skill Tag (optional)</label>
                  <SkillTagInput
                    selectedTags={resSkillTags}
                    onChange={setResSkillTags}
                    singleMode
                    placeholder="Tag a skill..."
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Personal Notes</label>
                <textarea
                  rows={2}
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Save Link
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
