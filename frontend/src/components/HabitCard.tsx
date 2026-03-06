import { useState, useMemo, useCallback } from 'react';
import { Tracker, Entry, api } from '../api/client';
import { useNavigate } from 'react-router-dom';

interface HabitCardProps {
  tracker: Tracker;
  entries: Entry[];
  onUpdate: () => void;
  onMenuAction: (action: 'edit' | 'delete', tracker: Tracker) => void;
}

function getWeekDays(): { label: string; dateStr: string }[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    return { label, dateStr };
  });
}

export default function HabitCard({ tracker, entries, onUpdate, onMenuAction }: HabitCardProps) {
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const weekDays = useMemo(() => getWeekDays(), []);

  const entryDateSet = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => {
      const d = new Date(e.timestamp);
      set.add(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`);
    });
    return set;
  }, [entries]);

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${(t.getMonth() + 1).toString().padStart(2, '0')}-${t.getDate().toString().padStart(2, '0')}`;
  }, []);

  const doneToday = entryDateSet.has(todayStr);

  // Streak calculations
  const stats = useMemo(() => {
    const sorted = [...entryDateSet].sort().reverse();
    let currentStreak = 0;
    let bestStreak = 0;

    if (sorted.length === 0) return { currentStreak: 0, bestStreak: 0, total: 0 };

    // Calculate current streak (consecutive days ending today or yesterday)
    const checkDate = new Date();
    if (!entryDateSet.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    let d = new Date(checkDate);
    while (true) {
      const ds = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      if (entryDateSet.has(ds)) {
        currentStreak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }

    // Best streak
    const allDates = [...entryDateSet].sort();
    let streak = 1;
    bestStreak = 1;
    for (let i = 1; i < allDates.length; i++) {
      const prev = new Date(allDates[i - 1]);
      const curr = new Date(allDates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streak++;
        bestStreak = Math.max(bestStreak, streak);
      } else {
        streak = 1;
      }
    }

    return { currentStreak, bestStreak, total: entries.length };
  }, [entryDateSet, todayStr, entries.length]);

  const handleDidIt = useCallback(async () => {
    if (loading || doneToday) return;
    setLoading(true);
    try {
      await api.createEntry(tracker.id);
      onUpdate();
    } finally {
      setLoading(false);
    }
  }, [loading, doneToday, tracker.id, onUpdate]);

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
          <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded uppercase">
            Habit
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

      {/* Stats */}
      <div className="space-y-1 mb-4 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex justify-between">
          <span>Current streak:</span>
          <span className="font-bold text-gray-900 dark:text-gray-100">{stats.currentStreak} days</span>
        </div>
        <div className="flex justify-between">
          <span>Best streak:</span>
          <span className="font-bold text-gray-900 dark:text-gray-100">{stats.bestStreak} days</span>
        </div>
        <div className="flex justify-between">
          <span>Total events:</span>
          <span className="font-bold text-gray-900 dark:text-gray-100">{stats.total}</span>
        </div>
      </div>

      {/* Week row */}
      <div className="flex gap-2 mb-4 justify-center">
        {weekDays.map(({ label, dateStr }, i) => {
          const done = entryDateSet.has(dateStr);
          const isToday = dateStr === todayStr;
          return (
            <div
              key={i}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors
                ${done
                  ? 'bg-emerald-500 text-white'
                  : isToday
                    ? 'border-2 border-indigo-400 dark:border-indigo-500 text-gray-700 dark:text-gray-300'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                }`}
            >
              {label}
            </div>
          );
        })}
      </div>

      {/* Did it button */}
      <button
        onClick={handleDidIt}
        disabled={loading || doneToday}
        className={`w-full py-3 rounded-lg font-bold text-white text-lg transition-colors
          ${doneToday
            ? 'bg-indigo-300 dark:bg-indigo-700 cursor-default'
            : 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700'
          }`}
      >
        {doneToday ? 'Already logged' : '✓ Did it!'}
      </button>
    </div>
  );
}
