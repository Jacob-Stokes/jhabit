export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3100';

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const rawText = await response.text();
  let parsed: ApiResponse<T>;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(rawText || 'API response could not be parsed');
  }

  if (!parsed.success) {
    throw new Error(parsed.error || 'API request failed');
  }

  return parsed.data as T;
}

export const api = {
  // Auth
  getMe: () => apiRequest<any>('/api/auth/me'),
  login: (username: string, password: string) =>
    apiRequest<any>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string, email?: string) =>
    apiRequest<any>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    }),
  logout: () =>
    apiRequest<any>('/api/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<any>('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // API Keys
  getApiKeys: () => apiRequest<any[]>('/api/auth/api-keys'),
  createApiKey: (name: string, expiresInDays?: number) =>
    apiRequest<any>('/api/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name, expiresInDays }),
    }),
  deleteApiKey: (id: string) =>
    apiRequest<any>(`/api/auth/api-keys/${id}`, { method: 'DELETE' }),

  // ─── Trackers ──────────────────────────────────────────────
  getTrackers: (type?: 'habit' | 'quit') =>
    apiRequest<Tracker[]>(`/api/trackers${type ? `?type=${type}` : ''}`),
  getTracker: (id: string) =>
    apiRequest<Tracker>(`/api/trackers/${id}`),
  createTracker: (name: string, type: 'habit' | 'quit', emoji?: string) =>
    apiRequest<Tracker>('/api/trackers', {
      method: 'POST',
      body: JSON.stringify({ name, type, emoji }),
    }),
  updateTracker: (id: string, data: { name?: string; emoji?: string; sort_order?: number }) =>
    apiRequest<Tracker>(`/api/trackers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTracker: (id: string) =>
    apiRequest<any>(`/api/trackers/${id}`, { method: 'DELETE' }),

  // ─── Entries ──────────────────────────────────────────────
  getEntries: (trackerId: string, month?: string) =>
    apiRequest<Entry[]>(`/api/trackers/${trackerId}/entries${month ? `?month=${month}` : ''}`),
  createEntry: (trackerId: string, timestamp?: string, note?: string) =>
    apiRequest<Entry>(`/api/trackers/${trackerId}/entries`, {
      method: 'POST',
      body: JSON.stringify({ timestamp, note }),
    }),
  deleteEntry: (id: string) =>
    apiRequest<any>(`/api/entries/${id}`, { method: 'DELETE' }),
};

// Types
export interface Tracker {
  id: string;
  user_id: string;
  name: string;
  type: 'habit' | 'quit';
  emoji: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Entry {
  id: string;
  tracker_id: string;
  user_id: string;
  timestamp: string;
  note: string | null;
  created_at: string;
}
