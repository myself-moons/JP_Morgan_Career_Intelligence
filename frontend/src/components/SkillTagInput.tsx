import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { resolveOrCreateSkill, suggestSkills } from '../services/api';
import { SkillSuggestion } from '../types';

interface SkillTagInputProps {
  selectedTags: string[];
  onChange: (nextTags: string[]) => void;
  placeholder?: string;
  singleMode?: boolean;
}

export const SkillTagInput: React.FC<SkillTagInputProps> = ({
  selectedTags,
  onChange,
  placeholder = 'Type a skill (e.g. Python, SQL, Collibra)...',
  singleMode = false,
}) => {
  const [query, setQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<SkillSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [resolving, setResolving] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await suggestSkills(query.trim(), 10);
        setSuggestions(res);
      } catch {
        setSuggestions([]);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const addResolvedTag = async (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;
    try {
      setResolving(true);
      const resolved = await resolveOrCreateSkill(trimmed);
      const canonical = resolved.canonical_name;
      if (singleMode) {
        onChange([canonical]);
      } else if (!selectedTags.some((t) => t.toLowerCase() === canonical.toLowerCase())) {
        onChange([...selectedTags, canonical]);
      }
      setQuery('');
      setIsOpen(false);
    } finally {
      setResolving(false);
    }
  };

  const handleSelectSuggestion = (item: SkillSuggestion) => {
    if (singleMode) {
      onChange([item.canonical_name]);
    } else if (!selectedTags.some((t) => t.toLowerCase() === item.canonical_name.toLowerCase())) {
      onChange([...selectedTags, item.canonical_name]);
    }
    setQuery('');
    setIsOpen(false);
  };

  const removeTag = (tag: string) => {
    onChange(selectedTags.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-2 relative">
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-blue-500 hover:text-blue-800"
                aria-label={`Remove ${tag}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 180)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (query.trim()) addResolvedTag(query);
            }
          }}
          placeholder={placeholder}
          className="flex-1 text-xs sm:text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {query.trim() && (
          <button
            type="button"
            disabled={resolving}
            onClick={() => addResolvedTag(query)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{resolving ? '...' : 'Add'}</span>
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-30 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
          {suggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectSuggestion(item);
              }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between gap-2 text-xs"
            >
              <div>
                <span className="font-semibold text-slate-900">{item.canonical_name}</span>
                {item.matched_alias && (
                  <span className="ml-1.5 text-[11px] text-slate-400">
                    (matched &ldquo;{item.matched_alias}&rdquo;)
                  </span>
                )}
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                {item.job_count} jobs
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
