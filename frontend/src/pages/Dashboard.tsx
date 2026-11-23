import React, { useState, useEffect } from 'react';
import {
  HealthStatus,
  JobListResponse,
  TopJobMatchesResponse,
  CoverageResponse,
  CrossRoleMatrixResponse,
  SkillCoverageItem,
  SkillEvidenceResponse,
} from '../types';
import {
  fetchJobs,
  fetchTopJobMatches,
  fetchSkillCoverage,
  fetchCrossRoleMatrix,
  fetchSkillEvidence,
} from '../services/api';
import {
  Briefcase,
  CheckCircle2,
  FileText,
  Cpu,
  Layers,
  ArrowRight,
  BarChart3,
  Trophy,
  Sparkles,
  Table,
  Grid,
  Search,
  Filter,
  Eye,
  X,
  FileSearch,
} from 'lucide-react';

interface DashboardProps {
  health: HealthStatus | null;
  onNavigate: (tab: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ health: _health, onNavigate }) => {
  const [jobStats, setJobStats] = useState<JobListResponse | null>(null);
  const [topMatches, setTopMatches] = useState<TopJobMatchesResponse | null>(null);

  // M4 Analytics State
  const [coverageData, setCoverageData] = useState<CoverageResponse | null>(null);
  const [matrixData, setMatrixData] = useState<CrossRoleMatrixResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(true);
  const [selectedRoleFamily, setSelectedRoleFamily] = useState<string>('All');
  const [analyticsViewMode, setAnalyticsViewMode] = useState<'table' | 'matrix'>('table');
  const [skillSearch, setSkillSearch] = useState<string>('');

  // Evidence Modal State
  const [evidenceSkill, setEvidenceSkill] = useState<SkillCoverageItem | null>(null);
  const [evidenceData, setEvidenceData] = useState<SkillEvidenceResponse | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchJobs()
      .then((data) => setJobStats(data))
      .catch(() => {});

    fetchTopJobMatches()
      .then((data) => setTopMatches(data))
      .catch(() => {});
  }, []);

  // Load M4 Coverage Data when role family or search changes
  useEffect(() => {
    setAnalyticsLoading(true);
    fetchSkillCoverage({
      role_family: selectedRoleFamily !== 'All' ? selectedRoleFamily : undefined,
      search: skillSearch.trim() || undefined,
    })
      .then((data) => setCoverageData(data))
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, [selectedRoleFamily, skillSearch]);

  // Load Cross-Role Matrix Data when matrix view is active
  useEffect(() => {
    if (analyticsViewMode === 'matrix' && !matrixData) {
      fetchCrossRoleMatrix()
        .then((data) => setMatrixData(data))
        .catch(() => {});
    }
  }, [analyticsViewMode, matrixData]);

  // Open Evidence Modal for a specific skill
  const handleOpenEvidence = async (skill: SkillCoverageItem) => {
    setEvidenceSkill(skill);
    setEvidenceLoading(true);
    try {
      const data = await fetchSkillEvidence(skill.skill_id, 'Available');
      setEvidenceData(data);
    } catch {
      setEvidenceData(null);
    } finally {
      setEvidenceLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 rounded-xl p-6 text-white shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 text-xs font-semibold px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Skill Intelligence & Role Matcher Ready</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              JPMorgan Career Intelligence Platform
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Explore JPMorgan Chase job openings, check your resume match with explainable AI,
              and compare which skills matter most across different roles.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => onNavigate('skills')}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition shadow-sm"
            >
              <FileSearch className="w-4 h-4" />
              <span>Explore Skills & Taxonomy</span>
            </button>
            <button
              onClick={() => onNavigate('jobs')}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-white font-medium text-sm transition"
            >
              <span>View Job Openings ({jobStats ? jobStats.total_count : 11})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Job Openings
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">
              {coverageData ? coverageData.analysable_count : 10}
            </span>
            <span className="text-xs text-slate-500">
              / {jobStats ? jobStats.total_count : 11} Total Postings
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Full descriptions ready to analyze
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tracked Skills
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">
              {coverageData ? coverageData.skills.length : 35}+
            </span>
            <span className="text-xs text-emerald-700 font-semibold">
              Standardized
            </span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 font-medium">
            Across Data, Tech, Governance & Finance
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              AI Match Assistant
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-purple-950">Gemini Flash</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Clear 3-way rubric: Tech, Domain & Seniority
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Daily Job Watcher
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">08:30 IST</span>
          </div>
          <div className="mt-2 text-xs text-amber-600 font-medium">
            Automated Daily Job Sync & Email Digest
          </div>
        </div>
      </div>

      {/* Top 5 Role Matches for Active Resume (Explainable AI Ranking) */}
      {topMatches && topMatches.top_matches.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-sm">
                <Trophy className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Top 5 Recommended Roles for Your Resume
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Clear Match Breakdown</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ranked against active profile: <strong className="text-slate-700">{topMatches.active_resume_name}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('resumes')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-xs font-semibold shadow-sm transition"
            >
              <span>Personalize in Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {topMatches.top_matches.map((match, idx) => (
              <div
                key={match.job_id}
                className="p-4 hover:bg-slate-50/80 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200 mt-0.5">
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {match.external_job_id || `ID-${match.job_id}`}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {match.title}
                      </h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {match.role_family.split(':')[0]}
                      </span>
                      {match.capture_date && (
                        <>
                          <span>&bull;</span>
                          <span className="text-[11px] text-slate-500">
                            Posted: <strong className="text-slate-700 font-semibold">{match.capture_date}</strong>
                          </span>
                        </>
                      )}
                      <span>&bull;</span>
                      <span className="text-[11px] text-slate-600">
                        Top Skills: <strong className="text-slate-800">{match.matched_skills.join(', ') || 'General overlap'}</strong>
                      </span>
                      <span>&bull;</span>
                      <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {match.readiness_verdict}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4 self-end md:self-center shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900">
                      {match.score}% Fit
                    </span>
                    <div className="w-24 bg-slate-100 rounded-full h-2 mt-1 overflow-hidden border border-slate-200">
                      <div
                        className={`h-2 rounded-full ${
                          match.score >= 80 ? 'bg-emerald-500' : match.score >= 65 ? 'bg-blue-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${match.score}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigate('resumes')}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 transition"
                    title="Open in Resume Workspace"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MILESTONE M4: COMPARATIVE ANALYTICS & CROSS-ROLE MATRIX */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Section Header */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900">
                Skills in Demand & Cross-Role Matrix
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Shows how many job postings ask for each skill ({coverageData ? coverageData.analysable_count : 10} verified roles analyzed). Postings without a full description are excluded to keep numbers honest.
            </p>
          </div>

          {/* View Switcher: Table vs Matrix */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="p-1 bg-slate-100 rounded-lg border border-slate-200 flex items-center">
              <button
                onClick={() => setAnalyticsViewMode('table')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
                  analyticsViewMode === 'table'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Most In-Demand Skills</span>
              </button>
              <button
                onClick={() => setAnalyticsViewMode('matrix')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
                  analyticsViewMode === 'matrix'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Job-by-Job Skill Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Role Family Filters (TC-12) */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </span>
            {['All', 'Family A', 'Family B', 'Family C'].map((fam) => (
              <button
                key={fam}
                onClick={() => setSelectedRoleFamily(fam)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition whitespace-nowrap ${
                  selectedRoleFamily === fam
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {fam === 'All' ? 'All Roles (N=10)' : `${fam}`}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search skill name..."
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-56 bg-white"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* View Mode 1: Coverage Table */}
        {analyticsViewMode === 'table' && (
          <div className="overflow-x-auto">
            {analyticsLoading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Computing mathematical skill coverage...
              </div>
            ) : !coverageData || coverageData.skills.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No skills found matching filter.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Skill Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Coverage %</th>
                    <th className="py-3 px-4 text-center">Jobs Asking</th>
                    <th className="py-3 px-4 text-center">Must-Have vs Preferred</th>
                    <th className="py-3 px-4 text-center">Role Tracks (A | B | C)</th>
                    <th className="py-3 px-4 text-right">Job Quotes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coverageData.skills.map((skill, idx) => (
                    <tr
                      key={skill.skill_id}
                      onClick={() => handleOpenEvidence(skill)}
                      className="hover:bg-slate-50/80 transition cursor-pointer group"
                    >
                      <td className="py-3 px-4 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 group-hover:text-blue-600 transition">
                        {skill.canonical_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {skill.category}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 w-10 text-right">
                            {skill.coverage_percentage}%
                          </span>
                          <div className="w-28 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                            <div
                              className={`h-2 rounded-full ${
                                skill.coverage_percentage >= 50
                                  ? 'bg-blue-600'
                                  : skill.coverage_percentage >= 25
                                  ? 'bg-indigo-500'
                                  : 'bg-slate-400'
                              }`}
                              style={{ width: `${Math.min(100, skill.coverage_percentage)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {skill.distinct_job_count} / {coverageData.analysable_count}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="text-red-700 font-semibold">{skill.required_count} Req</span>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className="text-blue-700 font-medium">{skill.preferred_count} Pref</span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap text-[11px] font-mono text-slate-600">
                        <span className="text-purple-700 font-bold">{skill.family_a_count}</span>
                        <span className="text-slate-300 mx-1">|</span>
                        <span className="text-blue-700 font-bold">{skill.family_b_count}</span>
                        <span className="text-slate-300 mx-1">|</span>
                        <span className="text-emerald-700 font-bold">{skill.family_c_count}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEvidence(skill);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition"
                          title="Inspect verbatim JD sentences across jobs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* View Mode 2: Cross-Role Matrix (FR-16) */}
        {analyticsViewMode === 'matrix' && matrixData && (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 min-w-[140px] sticky left-0 bg-slate-50 border-r border-slate-200 z-10">
                    Canonical Skill
                  </th>
                  {matrixData.jobs.map((job) => (
                    <th
                      key={job.job_id}
                      className="py-3 px-2 text-center min-w-[90px] border-r border-slate-200 text-[11px]"
                      title={`${job.title} (${job.role_family})`}
                    >
                      <div className="font-mono text-blue-700 font-bold">{job.external_job_id}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[85px] mx-auto">
                        {job.role_family.split(':')[0].replace('Family ', 'Fam ')}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrixData.skills.slice(0, 25).map((skill) => (
                  <tr key={skill.skill_id} className="hover:bg-slate-50/60 transition">
                    <td
                      onClick={() => handleOpenEvidence(skill)}
                      className="py-2.5 px-3 font-bold text-slate-900 sticky left-0 bg-white border-r border-slate-200 cursor-pointer hover:text-blue-600"
                    >
                      <div className="flex items-center justify-between">
                        <span>{skill.canonical_name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {skill.coverage_percentage}%
                        </span>
                      </div>
                    </td>
                    {matrixData.jobs.map((job) => {
                      const statusVal =
                        matrixData.matrix[skill.skill_id]?.[job.job_id] || 'none';
                      return (
                        <td
                          key={job.job_id}
                          className="py-2.5 px-2 text-center border-r border-slate-100"
                        >
                          {statusVal === 'required' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                              REQ
                            </span>
                          ) : statusVal === 'preferred' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              PREF
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VERBATIM EVIDENCE INSPECTION MODAL (FR-15 / FR-25) */}
      {evidenceSkill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {evidenceSkill.canonical_name}
                  </h3>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {evidenceSkill.category}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exact quotes from JPMorgan Chase job descriptions ({evidenceData ? evidenceData.items.length : 0} matching jobs)
                </p>
              </div>
              <button
                onClick={() => setEvidenceSkill(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
              {evidenceLoading ? (
                <div className="p-8 text-center text-slate-500">Loading verbatim evidence snippets...</div>
              ) : !evidenceData || evidenceData.items.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No evidence snippets recorded for this skill.</div>
              ) : (
                evidenceData.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                          {item.external_job_id || `ID-${item.job_id}`}
                        </span>
                        <h4 className="font-bold text-slate-900">{item.job_title}</h4>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          item.requirement_type === 'Required'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.requirement_type}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      {item.role_family.split(':')[0]} &bull; Status: {item.review_status}
                    </div>

                    <p className="italic text-slate-700 bg-white p-2.5 rounded border border-slate-200/80 leading-relaxed">
                      "{item.evidence_snippet}"
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setEvidenceSkill(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition"
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
