import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Tracker, Entry } from '../api/client';
import Calendar from '../components/Calendar';
import DayEntriesModal from '../components/DayEntriesModal';

function pad(n: number) {
  return n.toString().padStart(2, '0');
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

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}

interface StatRowProps {
  label: string;
  value: string | number;
  sub?: string;
}

function StatRow({ label, value, sub }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <div className="text-right">
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{value}</span>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
      </div>
    </div>
  );
}

export default function TrackerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [t, e] = await Promise.all([
        api.getTracker(id),
        api.getEntries(id),
      ]);
      setTracker(t);
      setEntries(e);
    } catch (err) {
      console.error('Failed to load tracker', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const entryDates = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => {
      const d = new Date(e.timestamp);
      set.add(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    });
    return set;
  }, [entries]);

  // Quit stats for the banner
  const quitStats = useMemo(() => {
    if (!tracker || tracker.type !== 'quit') return null;
    const lastEvent = entries.length > 0
      ? Math.max(...entries.map(e => new Date(e.timestamp).getTime()))
      : new Date(tracker.created_at).getTime();
    const elapsed = now - lastEvent;
    const targetMs = 90 * 24 * 60 * 60 * 1000;
    const progress = Math.min((elapsed / targetMs) * 100, 100);
    const months = Math.floor(elapsed / (30 * 24 * 60 * 60 * 1000));
    return { elapsed, progress, months };
  }, [tracker, entries, now]);

  // Comprehensive stats for the stats panel
  const stats = useMemo(() => {
    if (!tracker) return null;

    const createdAt = new Date(tracker.created_at);
    const todayDate = new Date();
    const totalDaysSinceCreation = Math.max(1, daysBetween(createdAt, todayDate) + 1);
    const uniqueDates = entryDates;
    const totalUniqueDays = uniqueDates.size;
    const totalEntries = entries.length;

    if (tracker.type === 'habit') {
      // Completion rate
      const completionRate = totalDaysSinceCreation > 0
        ? Math.round((totalUniqueDays / totalDaysSinceCreation) * 100)
        : 0;

      // Current streak
      const todayStr = `${todayDate.getFullYear()}-${pad(todayDate.getMonth() + 1)}-${pad(todayDate.getDate())}`;
      let currentStreak = 0;
      const checkDate = new Date(todayDate);
      if (!uniqueDates.has(todayStr)) checkDate.setDate(checkDate.getDate() - 1);
      const d = new Date(checkDate);
      while (true) {
        const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (uniqueDates.has(ds)) { currentStreak++; d.setDate(d.getDate() - 1); }
        else break;
      }

      // Best streak
      const sortedDates = [...uniqueDates].sort();
      let bestStreak = sortedDates.length > 0 ? 1 : 0;
      let streak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        if (Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)) === 1) {
          streak++;
          bestStreak = Math.max(bestStreak, streak);
        } else {
          streak = 1;
        }
      }

      // This week
      const dayOfWeek = todayDate.getDay();
      const mondayOffset = (dayOfWeek + 6) % 7;
      const monday = new Date(todayDate);
      monday.setDate(todayDate.getDate() - mondayOffset);
      let thisWeekCount = 0;
      for (let i = 0; i < 7; i++) {
        const wd = new Date(monday);
        wd.setDate(monday.getDate() + i);
        const ws = `${wd.getFullYear()}-${pad(wd.getMonth() + 1)}-${pad(wd.getDate())}`;
        if (uniqueDates.has(ws)) thisWeekCount++;
      }

      // This month
      const thisMonthPrefix = `${todayDate.getFullYear()}-${pad(todayDate.getMonth() + 1)}-`;
      let thisMonthCount = 0;
      uniqueDates.forEach(ds => { if (ds.startsWith(thisMonthPrefix)) thisMonthCount++; });
      const daysInMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();

      // Average per week
      const weeksSinceCreation = Math.max(1, totalDaysSinceCreation / 7);
      const avgPerWeek = (totalUniqueDays / weeksSinceCreation).toFixed(1);

      return {
        type: 'habit' as const,
        createdAt: formatDateShort(tracker.created_at),
        totalDaysSinceCreation,
        totalEntries,
        totalUniqueDays,
        completionRate,
        currentStreak,
        bestStreak,
        thisWeekCount,
        thisMonthCount,
        daysInMonth,
        avgPerWeek,
      };
    } else {
      // Quit stats
      const sortedEntries = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Longest clean streak (gap between slips, or from creation to first slip, or from last slip to now)
      const timestamps = [
        new Date(tracker.created_at).getTime(),
        ...sortedEntries.map(e => new Date(e.timestamp).getTime()),
        now,
      ];
      let longestCleanMs = 0;
      for (let i = 1; i < timestamps.length; i++) {
        const gap = timestamps[i] - timestamps[i - 1];
        longestCleanMs = Math.max(longestCleanMs, gap);
      }
      const longestCleanDays = Math.floor(longestCleanMs / (1000 * 60 * 60 * 24));

      // Current clean streak
      const lastSlipTime = sortedEntries.length > 0
        ? new Date(sortedEntries[sortedEntries.length - 1].timestamp).getTime()
        : new Date(tracker.created_at).getTime();
      const currentCleanDays = Math.floor((now - lastSlipTime) / (1000 * 60 * 60 * 24));

      // Average days between slips
      let avgDaysBetweenSlips = 'N/A';
      if (sortedEntries.length >= 2) {
        const firstSlip = new Date(sortedEntries[0].timestamp).getTime();
        const lastSlip = new Date(sortedEntries[sortedEntries.length - 1].timestamp).getTime();
        const spanDays = (lastSlip - firstSlip) / (1000 * 60 * 60 * 24);
        avgDaysBetweenSlips = (spanDays / (sortedEntries.length - 1)).toFixed(1) + ' days';
      }

      // Clean days percentage
      const totalSlipDays = new Set(
        sortedEntries.map(e => {
          const d = new Date(e.timestamp);
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        })
      ).size;
      const cleanDaysPct = totalDaysSinceCreation > 0
        ? Math.round(((totalDaysSinceCreation - totalSlipDays) / totalDaysSinceCreation) * 100)
        : 100;

      // This month slips
      const thisMonthPrefix = `${todayDate.getFullYear()}-${pad(todayDate.getMonth() + 1)}-`;
      let thisMonthSlips = 0;
      sortedEntries.forEach(e => {
        const d = new Date(e.timestamp);
        const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (ds.startsWith(thisMonthPrefix)) thisMonthSlips++;
      });

      return {
        type: 'quit' as const,
        createdAt: formatDateShort(tracker.created_at),
        totalDaysSinceCreation,
        totalSlips: totalEntries,
        totalSlipDays,
        cleanDaysPct,
        currentCleanDays,
        longestCleanDays,
        avgDaysBetweenSlips,
        thisMonthSlips,
      };
    }
  }, [tracker, entries, entryDates, now]);

  const handlePrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const handleNextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#6366f1] flex items-center justify-center">
        <p className="text-white/70">Loading...</p>
      </div>
    );
  }

  if (!tracker) {
    return (
      <div className="min-h-screen bg-[#6366f1] flex items-center justify-center">
        <p className="text-white/70">Tracker not found</p>
      </div>
    );
  }

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = quitStats ? circumference - (quitStats.progress / 100) * circumference : 0;

  return (
    <div className="min-h-screen bg-[#6366f1]">
      <div className="w-full lg:w-3/5 mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-gray-600/80 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors"
        >
          &larr; Back
        </button>
        <h1 className="text-2xl font-bold text-white">
          {tracker.emoji && <span className="mr-1">{tracker.emoji}</span>}
          {tracker.name}
        </h1>
      </div>

      {/* Quit stats banner */}
      {tracker.type === 'quit' && quitStats && (
        <div className="px-4 pb-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex items-center justify-center gap-8">
            {/* Progress ring */}
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-gray-200 dark:text-gray-600" />
                <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="7" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="text-indigo-500 transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{quitStats.progress.toFixed(1)}%</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{quitStats.months}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 uppercase">months</span>
              </div>
            </div>

            {/* Timer */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Abstinence time
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {formatDuration(quitStats.elapsed)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="px-4 pb-4">
        <Calendar
          year={year}
          month={month}
          entryDates={entryDates}
          onDayClick={setSelectedDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />
      </div>

      {/* Stats panel */}
      {stats && (
        <div className="px-4 pb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Statistics</h3>

            {stats.type === 'habit' ? (
              <>
                <StatRow label="Completion rate" value={`${stats.completionRate}%`} sub={`${stats.totalUniqueDays} of ${stats.totalDaysSinceCreation} days`} />
                <StatRow label="Current streak" value={`${stats.currentStreak} days`} />
                <StatRow label="Best streak" value={`${stats.bestStreak} days`} />
                <StatRow label="This week" value={`${stats.thisWeekCount} / 7 days`} />
                <StatRow label="This month" value={`${stats.thisMonthCount} / ${stats.daysInMonth} days`} />
                <StatRow label="Avg per week" value={`${stats.avgPerWeek} days`} />
                <StatRow label="Total entries" value={stats.totalEntries} />
                <StatRow label="Tracking since" value={stats.createdAt} sub={`${stats.totalDaysSinceCreation} days ago`} />
              </>
            ) : (
              <>
                <StatRow label="Clean days" value={`${stats.cleanDaysPct}%`} sub={`${stats.totalDaysSinceCreation - stats.totalSlipDays} of ${stats.totalDaysSinceCreation} days`} />
                <StatRow label="Current clean streak" value={`${stats.currentCleanDays} days`} />
                <StatRow label="Longest clean streak" value={`${stats.longestCleanDays} days`} />
                <StatRow label="Total slip-ups" value={stats.totalSlips} />
                <StatRow label="Slip-up days" value={stats.totalSlipDays} />
                <StatRow label="Avg between slips" value={stats.avgDaysBetweenSlips} />
                <StatRow label="This month slips" value={stats.thisMonthSlips} />
                <StatRow label="Tracking since" value={stats.createdAt} sub={`${stats.totalDaysSinceCreation} days ago`} />
              </>
            )}
          </div>
        </div>
      )}

      </div>{/* end centered wrapper */}

      {/* Day entries modal */}
      {selectedDate && (
        <DayEntriesModal
          date={selectedDate}
          entries={entries}
          trackerType={tracker.type}
          trackerId={tracker.id}
          onClose={() => setSelectedDate(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}
