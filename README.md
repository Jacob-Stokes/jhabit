<p align="center">
  <img src="frontend/public/logo.svg" alt="jhabit" width="96" />
</p>

<h1 align="center">jhabit</h1>

A habit and quit tracker. Track things you want to do (habits) and things you want to stop doing (quits). Built on a full-stack TypeScript micro app template with auth, API keys, MCP for AI agents, and Docker deployment.

## What It Does

- **Habits** — Track daily habits (e.g., Meditate, Exercise). Log completions, see streaks, view calendar history.
- **Quits** — Track things you're quitting (e.g., Smoking). Live abstinence timer, slip-up logging, clean streak tracking.

Both types share the same data model — a tracker with entries. For habits, entries mean "I did it". For quits, entries mean "I slipped up".

## Features

- Tab-based home screen (Habits / Quits) with grid and list views
- Habit cards with day-of-week indicators, streaks, and "Did it!" button
- Quit cards with live ticking abstinence timer, progress ring, and "Slipped up" button
- Full calendar detail view per tracker (click any day to see/add/delete entries)
- Statistics panel: completion rate, streaks, averages, clean days %, and more
- Three ways to access: Web UI, API keys, MCP (for AI agents like Claude)
- Single-container Docker deployment

## Architecture

Single-container app. Express serves both the API and the React SPA.

```
┌──────────────────────────────────────────────┐
│                   Docker                      │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │            Express Server               │  │
│  │                                         │  │
│  │  /api/trackers/*  → Tracker CRUD        │  │
│  │  /api/entries/*   → Entry CRUD          │  │
│  │  /api/auth/*      → Login, register,    │  │
│  │                     API keys            │  │
│  │  /mcp             → MCP (Streamable HTTP│  │
│  │  /.well-known/*   → OAuth 2.1 discovery │  │
│  │  /*               → React SPA (static)  │  │
│  │                                         │  │
│  │  ┌───────────┐                          │  │
│  │  │  SQLite   │  ./data/jhabit.db        │  │
│  │  └───────────┘                          │  │
│  └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

## Data Model

```sql
trackers (id, user_id, name, type[habit|quit], emoji, sort_order, created_at, updated_at)
entries  (id, tracker_id, user_id, timestamp, note, created_at)
```

## Tech Stack

| Layer | Tech |
|-------|------|
| **Runtime** | Node.js 20 |
| **Backend** | Express + TypeScript |
| **Database** | SQLite (better-sqlite3) |
| **Frontend** | React 18 + Vite + Tailwind CSS |
| **Auth** | Sessions + API keys + OAuth 2.1 |
| **MCP** | @modelcontextprotocol/sdk (Streamable HTTP) |
| **Build** | Docker multi-stage |
| **CI/CD** | GitHub Actions → GHCR |

## Quick Start

Create a `.env` file:
```bash
SESSION_SECRET=your-secret-here
```

Create a `docker-compose.yml`:
```yaml
services:
  app:
    build: .
    ports:
      - "3100:3100"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3100
      - SESSION_SECRET=${SESSION_SECRET:?Set SESSION_SECRET in .env}
    restart: unless-stopped
```

Run:
```bash
docker-compose up -d
```

Register your account:
```bash
curl -X POST http://localhost:3100/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"you","password":"your-password"}'
```

Visit http://localhost:3100 and log in.

## Development

```bash
# Backend (port 3100)
cd backend && npm install && npm run dev

# Frontend (port 3200)
cd frontend && npm install && npm run dev
```

## API Endpoints

**Trackers:**
- `GET /api/trackers` — list trackers (optional `?type=habit|quit`)
- `GET /api/trackers/:id` — get single tracker
- `POST /api/trackers` — create `{ name, type, emoji? }`
- `PUT /api/trackers/:id` — update `{ name?, emoji?, sort_order? }`
- `DELETE /api/trackers/:id` — delete tracker + all entries

**Entries:**
- `GET /api/trackers/:id/entries` — list entries (optional `?month=YYYY-MM`)
- `POST /api/trackers/:id/entries` — create `{ timestamp?, note? }`
- `DELETE /api/entries/:id` — delete entry

## MCP Tools

AI agents (e.g., Claude) can interact via MCP:

- `list_trackers(type?)` — list habits/quits
- `create_tracker(name, type, emoji?)` — create a tracker
- `log_entry(tracker_id, timestamp?, note?)` — log a completion or slip-up
- `delete_entry(entry_id)` — remove an entry
- `get_tracker_stats(tracker_id)` — streaks, completion rates, abstinence time

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes | Session encryption key |
| `APP_NAME` | No | App name (default: `jhabit`) |
| `PORT` | No | Server port (default: `3100`) |
| `MCP_SERVER_URL` | For remote MCP | Public URL for OAuth metadata |
| `COOKIE_SECURE` | No | Set to `true` when behind HTTPS |
| `FRONTEND_URL` | No | CORS origin for dev (default: `http://localhost:3200`) |

## Deployment

Push to `main` triggers GitHub Actions → builds Docker image → pushes to GHCR.

On your server:
```bash
docker-compose pull && docker-compose up -d
```
