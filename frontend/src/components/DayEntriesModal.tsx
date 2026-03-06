import { Entry, api } from '../api/client';
import { useState } from 'react';

interface DayEntriesModalProps {
  date: string; // YYYY-MM-DD
  entries: Entry[];
  trackerType: 'habit' | 'quit';
  trackerId: string;
  onClose: () => void;
  onUpdate: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function DayEntriesModal({ date, entries, trackerType, trackerId, onClose, onUpdate }: DayEntriesModalProps) {
  const [loading, setLoading] = useState(false);

  const dayEntries = entries.filter(e => {
    const d = new Date(e.timestamp);
    const ds = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    return ds === date;
  });

  const handleDelete = async (entryId: string) => {
    setLoading(true);
    try {
      await api.deleteEntry(entryId);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    setLoading(true);
    try {
      // Create entry at noon of the selected date
      const ts = new Date(date + 'T12:00:00').toISOString();
      await api.createEntry(trackerId, ts);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const hasEntries = dayEntries.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Entries for {formatDate(date)}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">
            &times;
          </button>
        </div>

        {/* Entries list */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {dayEntries.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No entries for this day</p>
          ) : (
            <div className="space-y-2">
              {dayEntries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {formatTime(entry.timestamp)}
                    </span>
                    {entry.note && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{entry.note}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={loading}
                    className="px-3 py-1 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer action */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {hasEntries ? (
            <button
              onClick={handleAdd}
              disabled={loading}
              className="w-full py-3 rounded-lg font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
            >
              + Add another entry
            </button>
          ) : (
            <button
              onClick={handleAdd}
              disabled={loading}
              className="w-full py-3 rounded-lg font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors"
            >
              {trackerType === 'habit' ? '✓ Log it' : 'Log slip-up'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
