import { useState } from 'react';

interface TrackerFormProps {
  mode: 'create' | 'edit';
  initialName?: string;
  initialType?: 'habit' | 'quit';
  initialEmoji?: string;
  onSubmit: (data: { name: string; type: 'habit' | 'quit'; emoji?: string }) => void;
  onCancel: () => void;
}

export default function TrackerForm({ mode, initialName = '', initialType = 'habit', initialEmoji = '', onSubmit, onCancel }: TrackerFormProps) {
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<'habit' | 'quit'>(initialType);
  const [emoji, setEmoji] = useState(initialEmoji);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), type, emoji: emoji.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {mode === 'create' ? 'New Tracker' : 'Edit Tracker'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="e.g. Meditate"
              autoFocus
              required
            />
          </div>

          {mode === 'create' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType('habit')}
                  className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                    type === 'habit'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Habit
                </button>
                <button
                  type="button"
                  onClick={() => setType('quit')}
                  className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                    type === 'quit'
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Quit
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emoji (optional)</label>
            <input
              type="text"
              value={emoji}
              onChange={e => setEmoji(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="e.g. 🧘"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
