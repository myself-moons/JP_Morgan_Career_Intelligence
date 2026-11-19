import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { Dashboard } from './pages/Dashboard';
import { JobLibrary } from './pages/JobLibrary';
import { ResumeWorkspace } from './pages/ResumeWorkspace';
import { SkillAnalysis } from './pages/SkillAnalysis';
import { ProfileMatcher } from './pages/ProfileMatcher';
import { LearningTracker } from './pages/LearningTracker';
import { ActiveTab, HealthStatus } from './types';
import { checkHealth } from './services/api';
import { Database, ExternalLink } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await checkHealth();
      setHealth(data);
    } catch (err: any) {
      setError(err?.message || 'Could not connect to FastAPI server');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      <Header
        health={health}
        loading={loading}
        error={error}
        onRefreshHealth={fetchHealth}
      />

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <Dashboard health={health} onNavigate={setActiveTab} />
        )}
        {activeTab === 'jobs' && <JobLibrary />}
        {activeTab === 'resumes' && <ResumeWorkspace />}
        {activeTab === 'skills' && <SkillAnalysis />}
        {activeTab === 'profile' && <ProfileMatcher />}
        {activeTab === 'learning' && <LearningTracker />}
        {activeTab === 'db_console' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                  <Database className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Live Web Database Console (FR-41)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Direct browser-based inspection for local SQLite tables, schemas, and queries.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs my-4 space-y-2">
                <div className="text-slate-400"># Start the console anytime with:</div>
                <div className="text-emerald-400 font-semibold">python backend/run_db_console.py</div>
                <div className="text-slate-400"># Or from frontend/:</div>
                <div className="text-emerald-400 font-semibold">npm run db:console</div>
              </div>

              <p className="text-sm text-slate-600 mb-6">
                Just like visiting the Firebase Realtime DB Console, this opens an interactive web viewer at{' '}
                <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono text-xs">
                  http://127.0.0.1:8080
                </code>{' '}
                allowing you to view all tables (jobs, skills, extractions, evidence), execute custom SQL statements,
                and inspect records in real time.
              </p>

              <div className="flex items-center space-x-4">
                <a
                  href="http://127.0.0.1:8080"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm transition shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Database Console</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>JPMorgan Career Intelligence (JCI) &bull; Phase 1 Local-First Architecture</span>
          <span className="font-mono text-[11px] text-slate-400">Milestone M0 Scaffolding</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
