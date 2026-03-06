/**
 * MCP tool definitions for jhabit — habit and quit tracker.
 * Each tool gets the authenticated userId from the OAuth token via extra.authInfo.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { v4 as uuidv4 } from 'uuid';
import { db, Tracker, Entry } from '../db/database';

function asTextContent(obj: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(obj, null, 2) }] };
}

function getUserId(extra: any): string {
  const userId = extra?.authInfo?.extra?.userId;
  if (!userId) throw new Error('Authentication required');
  return userId;
}

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: process.env.APP_NAME || 'jhabit',
    version: '1.0.0',
  });

  // ─── list_trackers ──────────────────────────────────────────

  server.registerTool('list_trackers', {
    description: 'List all habits and/or quits for the authenticated user.',
    inputSchema: {
      type: z.enum(['habit', 'quit']).optional().describe('Filter by type. Omit to list all.'),
    },
  }, async (args, extra) => {
    const userId = getUserId(extra);
    let trackers;
    if (args.type) {
      trackers = db.prepare('SELECT * FROM trackers WHERE user_id = ? AND type = ? ORDER BY sort_order, created_at DESC').all(userId, args.type) as Tracker[];
    } else {
      trackers = db.prepare('SELECT * FROM trackers WHERE user_id = ? ORDER BY sort_order, created_at DESC').all(userId) as Tracker[];
    }
    return asTextContent(trackers);
  });

  // ─── create_tracker ─────────────────────────────────────────

  server.registerTool('create_tracker', {
    description: 'Create a new habit or quit tracker.',
    inputSchema: {
      name: z.string().describe('Tracker name, e.g. "Meditate" or "Smoking"'),
      type: z.enum(['habit', 'quit']).describe('Whether this is a habit (do it) or quit (stop it)'),
      emoji: z.string().optional().describe('Optional emoji icon'),
    },
  }, async (args, extra) => {
    const userId = getUserId(extra);
    const id = uuidv4();
    db.prepare('INSERT INTO trackers (id, user_id, name, type, emoji) VALUES (?, ?, ?, ?, ?)').run(id, userId, args.name, args.type, args.emoji || null);
    const tracker = db.prepare('SELECT * FROM trackers WHERE id = ?').get(id) as Tracker;
    return asTextContent(tracker);
  });

  // ─── log_entry ──────────────────────────────────────────────

  server.registerTool('log_entry', {
    description: 'Log an entry for a tracker. For habits this means "I did it". For quits this means "I slipped up".',
    inputSchema: {
      tracker_id: z.string().describe('Tracker ID'),
      timestamp: z.string().optional().describe('ISO timestamp. Defaults to now.'),
      note: z.string().optional().describe('Optional note'),
    },
  }, async (args, extra) => {
    const userId = getUserId(extra);
    const tracker = db.prepare('SELECT * FROM trackers WHERE id = ? AND user_id = ?').get(args.tracker_id, userId) as Tracker | undefined;
    if (!tracker) return asTextContent({ error: 'Tracker not found or access denied' });

    const id = uuidv4();
    const ts = args.timestamp || new Date().toISOString();
    db.prepare('INSERT INTO entries (id, tracker_id, user_id, timestamp, note) VALUES (?, ?, ?, ?, ?)').run(id, args.tracker_id, userId, ts, args.note || null);
    const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(id) as Entry;
    return asTextContent(entry);
  });

  // ─── delete_entry ───────────────────────────────────────────

  server.registerTool('delete_entry', {
    description: 'Delete an entry by ID.',
    inputSchema: {
      entry_id: z.string().describe('Entry ID to delete'),
    },
  }, async (args, extra) => {
    const userId = getUserId(extra);
    const result = db.prepare('DELETE FROM entries WHERE id = ? AND user_id = ?').run(args.entry_id, userId);
    if (result.changes === 0) return asTextContent({ error: 'Entry not found or access denied' });
    return asTextContent({ deleted: true, id: args.entry_id });
  });

  // ─── get_tracker_stats ──────────────────────────────────────

  server.registerTool('get_tracker_stats', {
    description: 'Get stats for a tracker: streaks for habits, abstinence time for quits.',
    inputSchema: {
      tracker_id: z.string().describe('Tracker ID'),
    },
  }, async (args, extra) => {
    const userId = getUserId(extra);
    const tracker = db.prepare('SELECT * FROM trackers WHERE id = ? AND user_id = ?').get(args.tracker_id, userId) as Tracker | undefined;
    if (!tracker) return asTextContent({ error: 'Tracker not found or access denied' });

    const entries = db.prepare('SELECT * FROM entries WHERE tracker_id = ? ORDER BY timestamp DESC').all(args.tracker_id) as Entry[];

    if (tracker.type === 'habit') {
      // Compute unique entry dates
      const dates = new Set<string>();
      entries.forEach(e => {
        const d = new Date(e.timestamp);
        dates.add(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`);
      });

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

      // Current streak
      let currentStreak = 0;
      const checkDate = new Date();
      if (!dates.has(todayStr)) checkDate.setDate(checkDate.getDate() - 1);
      const d = new Date(checkDate);
      while (true) {
        const ds = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
        if (dates.has(ds)) { currentStreak++; d.setDate(d.getDate() - 1); }
        else break;
      }

      // Best streak
      const sortedDates = [...dates].sort();
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

      return asTextContent({
        tracker_id: tracker.id,
        name: tracker.name,
        type: 'habit',
        current_streak: currentStreak,
        best_streak: bestStreak,
        total_entries: entries.length,
        total_days: dates.size,
      });
    } else {
      // Quit: abstinence time
      const lastSlip = entries.length > 0 ? new Date(entries[0].timestamp).getTime() : new Date(tracker.created_at).getTime();
      const abstinenceMs = Date.now() - lastSlip;
      const abstinenceDays = Math.floor(abstinenceMs / (1000 * 60 * 60 * 24));

      return asTextContent({
        tracker_id: tracker.id,
        name: tracker.name,
        type: 'quit',
        abstinence_days: abstinenceDays,
        abstinence_ms: abstinenceMs,
        total_slips: entries.length,
        last_slip: entries.length > 0 ? entries[0].timestamp : null,
        quit_started: tracker.created_at,
      });
    }
  });

  return server;
}
