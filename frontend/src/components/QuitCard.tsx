import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tracker, Entry, api } from '../api/client';
import { useNavigate } from 'react-router-dom';

interface QuitCardProps {
  tracker: Tracker;
  entries: Entry[];
  onUpdate: () => void;
  onMenuAction: (action: 'edit' | 'delete', tracker: Tracker) => void;
}

function formatDuration(ms: number): string {
  if (ms < 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  parts.push(`${seconds % 60}s`);
  return parts.join(' ');
}

export default function QuitCard({ tracker, entries, onUpdate, onMenuAction }: QuitCardProps) {
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();

  // Tick every second for live timer
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Last slip-up (most recent entry), or tracker creation date
  const lastEvent = useMemo(() => {
    if (entries.length === 0) return new Date(tracker.created_at).getTime();
    const sorted = [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return new Date(sorted[0].timestamp).getTime();
  }, [entries, tracker.created_at]);

  const elapsed = now - lastEvent;
  const targetMs = 90 * 24 * 60 * 60 * 1000; // 3 months
  const progress = Math.min((elapsed / targetMs) * 100, 100);

  const handleSlipUp = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await api.createEntry(tracker.id);
      onUpdate();
    } finally {
      setLoading(false);
    }
  }, [loading, tracker.id, onUpdate]);

  // SVG circular progress
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const months = Math.floor(elapsed / (30 * 24 * 60 * 60 * 1000));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div
          className="flex items-center gap-2 cursor-pointer hover:opacity-80"
          onClick={() => navigate(`/tracker/${tracker.id}`)}
        >
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {tracker.emoji && <span className="mr-1">{tracker.emoji}</span>}
            {tracker.name}
          </h3>
          <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded uppercase">
            Quit
          </span>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          >
            &middot;&middot;&middot;
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 bg-white dark:bg-gray-700 shadow-lg rounded-lg py-1 z-10 min-w-[120px]">
              <button
                onClick={() => { setMenuOpen(false); onMenuAction('edit', tracker); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Edit
              </button>
              <button
                onClick={() => { setMenuOpen(false); onMenuAction('delete', tracker); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Timer + progress ring */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Abstinence time
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatDuration(elapsed)}
          </p>
        </div>
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200 dark:text-gray-600" />
            <circle cx="48" cy="48" r={radius} fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="text-indigo-500 transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{progress.toFixed(1)}%</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{months}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase">months</span>
          </div>
        </div>
      </div>

      {/* Slipped up button */}
      <button
        onClick={handleSlipUp}
        disabled={loading}
        className="inline-flex items-center gap-1 px-4 py-2 rounded-lg font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
      >
        {tracker.emoji && <span>{tracker.emoji}</span>} Slipped up
      </button>
    </div>
  );
}
