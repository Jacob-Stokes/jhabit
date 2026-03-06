import { useState, useEffect, useCallback } from 'react';
import { api, Tracker, Entry } from '../api/client';
import HabitCard from '../components/HabitCard';
import QuitCard from '../components/QuitCard';
import TrackerForm from '../components/TrackerForm';
import ConfirmModal from '../components/ConfirmModal';

type Tab = 'habit' | 'quit';
type ViewMode = 'grid' | 'list';

export default function Home() {
  const [tab, setTab] = useState<Tab>('habit');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [entriesMap, setEntriesMap] = useState<Record<string, Entry[]>>({});
  const [loading, setLoading] = useState(true);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editTracker, setEditTracker] = useState<Tracker | null>(null);
  const [deleteTracker, setDeleteTracker] = useState<Tracker | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const allTrackers = await api.getTrackers();
      setTrackers(allTrackers);

      // Fetch entries for all trackers
      const map: Record<string, Entry[]> = {};
      await Promise.all(allTrackers.map(async (t) => {
        const entries = await api.getEntries(t.id);
        map[t.id] = entries;
      }));
      setEntriesMap(map);
    } catch (err) {
      console.error('Failed to load trackers', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = trackers.filter(t => t.type === tab);
  const habitCount = trackers.filter(t => t.type === 'habit').length;
  const quitCount = trackers.filter(t => t.type === 'quit').length;

  const handleCreate = async (data: { name: string; type: 'habit' | 'quit'; emoji?: string }) => {
    await api.createTracker(data.name, data.type, data.emoji);
    setShowForm(false);
    fetchData();
  };

  const handleEdit = async (data: { name: string; type: 'habit' | 'quit'; emoji?: string }) => {
    if (!editTracker) return;
    await api.updateTracker(editTracker.id, { name: data.name, emoji: data.emoji });
    setEditTracker(null);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTracker) return;
    await api.deleteTracker(deleteTracker.id);
    setDeleteTracker(null);
    fetchData();
  };

  const handleMenuAction = (action: 'edit' | 'delete', tracker: Tracker) => {
    if (action === 'edit') setEditTracker(tracker);
    else setDeleteTracker(tracker);
  };

  const handleLogout = async () => {
    await api.logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-[#6366f1]">
      <div className="w-full lg:w-3/5 mx-auto">
      {/* Tab bar */}
      <div className="flex items-center gap-2 pt-4 pb-2 px-4">
        <img src="/logo.svg" alt="jhabit" className="w-8 h-8 mr-1" />
        <button
          onClick={() => setTab('habit')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all ${
            tab === 'habit'
              ? 'bg-white text-gray-900 shadow-md'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          <span>✅</span> Habits
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
            tab === 'habit' ? 'bg-indigo-100 text-indigo-700' : 'bg-white/20 text-white'
          }`}>{habitCount}</span>
        </button>
        <button
          onClick={() => setTab('quit')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all ${
            tab === 'quit'
              ? 'bg-white text-gray-900 shadow-md'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          <span>🚫</span> Quits
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
            tab === 'quit' ? 'bg-indigo-100 text-indigo-700' : 'bg-white/20 text-white'
          }`}>{quitCount}</span>
        </button>

        {/* View toggle + menu */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white/30 text-white' : 'text-white/60 hover:text-white'}`}
            title="Grid view"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white/30 text-white' : 'text-white/60 hover:text-white'}`}
            title="List view"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg text-white/60 hover:text-white transition-colors"
            >
              &middot;&middot;&middot;
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 bg-white dark:bg-gray-700 shadow-lg rounded-lg py-1 z-10 min-w-[140px]">
                <button
                  onClick={() => { setShowMenu(false); handleLogout(); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-24 pt-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-white/70">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-white/70 mb-4">
              No {tab === 'habit' ? 'habits' : 'quits'} yet
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl shadow-lg hover:shadow-xl transition-shadow"
            >
              + Add your first {tab}
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
            : 'space-y-3'
          }>
            {filtered.map(tracker => (
              tab === 'habit' ? (
                <HabitCard
                  key={tracker.id}
                  tracker={tracker}
                  entries={entriesMap[tracker.id] || []}
                  onUpdate={fetchData}
                  onMenuAction={handleMenuAction}
                />
              ) : (
                <QuitCard
                  key={tracker.id}
                  tracker={tracker}
                  entries={entriesMap[tracker.id] || []}
                  onUpdate={fetchData}
                  onMenuAction={handleMenuAction}
                />
              )
            ))}
          </div>
        )}
      </div>

      </div>{/* end centered wrapper */}

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-white text-indigo-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center text-3xl font-light transition-shadow z-40"
      >
        +
      </button>

      {/* Modals */}
      {showForm && (
        <TrackerForm
          mode="create"
          initialType={tab}
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editTracker && (
        <TrackerForm
          mode="edit"
          initialName={editTracker.name}
          initialType={editTracker.type}
          initialEmoji={editTracker.emoji || ''}
          onSubmit={handleEdit}
          onCancel={() => setEditTracker(null)}
        />
      )}

      {deleteTracker && (
        <ConfirmModal
          title="Delete Tracker"
          message={`Are you sure you want to delete "${deleteTracker.name}"? All entries will be lost.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTracker(null)}
        />
      )}
    </div>
  );
}
