import React from 'react';
import { ActiveTab } from '../types';
import {
  LayoutDashboard,
  Briefcase,
  FileSearch,
  UserCheck,
  GraduationCap,
  Database,
  FileText,
} from 'lucide-react';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'jobs',
      label: 'Job Library',
      icon: <Briefcase className="w-4 h-4" />,
    },
    {
      id: 'resumes',
      label: 'Resume Workspace',
      icon: <FileText className="w-4 h-4" />,
      badge: 'LaTeX / PDF',
    },
    {
      id: 'skills',
      label: 'Skill Analysis',
      icon: <FileSearch className="w-4 h-4" />,
    },
    {
      id: 'profile',
      label: 'Profile & Resume',
      icon: <UserCheck className="w-4 h-4" />,
      badge: 'Keywords',
    },
    {
      id: 'learning',
      label: 'Learning Tracker',
      icon: <GraduationCap className="w-4 h-4" />,
    },
    {
      id: 'db_console',
      label: 'Database Console',
      icon: <Database className="w-4 h-4" />,
      badge: 'SQL',
    },
  ];

  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition whitespace-nowrap ${isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isActive
                        ? 'bg-blue-200 text-blue-800'
                        : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
