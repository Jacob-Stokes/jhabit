# My App

A full-stack TypeScript micro app with built-in auth, API keys, remote MCP endpoint with OAuth 2.1, and Docker deployment.

## Philosophy

This is a template for building small, focused apps — each one does one thing well. Every app ships with the same plumbing: auth, API keys, remote MCP for AI agents, Docker deployment, CI/CD. You just add your domain logic.

The idea: a constellation of micro apps for different parts of life, all accessible to AI agents via MCP, all deployable the same way.

## Architecture

Single-container app. Express serves both the API and the frontend static files. No separate web server needed.

```
┌──────────────────────────────────────────────┐
│                   Docker                      │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │            Express Server               │  │
│  │                                         │  │
│  │  /api/*          → REST endpoints       │  │
│  │  /api/auth/*     → Login, register,     │  │
│  │                    API keys             │  │
│  │  /mcp            → MCP (Streamable HTTP)│  │
│  │  /.well-known/*  → OAuth 2.1 discovery  │  │
│  │  /*              → React SPA (static)   │  │
│  │                                         │  │
│  │  ┌───────────┐                          │  │
│  │  │  SQLite   │  ./data/app.db           │  │
│  │  └───────────┘                          │  │
│  └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

Three ways to talk to the app:
1. **Web UI** — React SPA, session-based auth
2. **API keys** — programmatic access, `X-API-Key` header
3. **MCP** — AI agents connect via OAuth 2.1, use tools to interact with your data

## Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| **Runtime** | Node.js 20 | LTS, TypeScript native |
| **Backend** | Express + TypeScript | Simple, flexible, huge ecosystem |
| **Database** | SQLite (better-sqlite3) | Zero config, single file, fast. Perfect for micro apps |
| **Frontend** | React 18 + Vite | Fast dev, fast builds |
| **Styling** | Tailwind CSS | Utility-first, dark mode via `class` strategy |
| **Auth** | express-session + bcrypt | Session cookies for web, API keys for programmatic, OAuth 2.1 for MCP |
| **MCP** | @modelcontextprotocol/sdk | Streamable HTTP transport, works with Claude mobile/web |
| **Build** | Docker multi-stage | Frontend build → backend build → slim production image |
| **CI/CD** | GitHub Actions → GHCR | Push to main = new image |

## Project Structure

```
├── backend/
│   └── src/
│       ├── index.ts            # Express server, routes, middleware
│       ├── db/database.ts      # SQLite schema + init
│       ├── middleware/auth.ts   # Session + API key auth
│       ├── routes/auth.ts      # Login, register, API key CRUD
│       ├── mcp/
│       │   ├── server.ts       # MCP route mounting
│       │   ├── tools.ts        # Your MCP tools go here
│       │   ├── oauth-provider.ts  # OAuth 2.1 provider
│       │   └── auth-page.ts    # OAuth login page
│       └── utils/response.ts   # Standard API response helpers
├── frontend/
│   └── src/
│       ├── App.tsx             # Router + protected routes
│       ├── pages/              # Your app pages
│       ├── api/client.ts       # API client with auth
│       ├── context/ThemeContext.tsx  # Dark mode
│       └── components/         # Shared components
├── Dockerfile                  # 3-stage build
├── docker-compose.yml
└── .github/workflows/docker.yml
```

## Auth Model

- **First user to register becomes admin.** No registration page — hit `POST /api/auth/register` directly.
- **Sessions** for the web UI (httpOnly cookies)
- **API keys** for scripts/automation (`X-API-Key` header). Users create/manage keys via the API.
- **OAuth 2.1** for MCP — AI agents authenticate with username/password via the OAuth flow, get scoped tokens.

All three auth methods resolve to the same user. Your routes just use `requireAuth` middleware and get `req.user`.

## Quick Start

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

# Frontend (port 3000, proxies API to 3100)
cd frontend && npm install && npm run dev
```

## What to Customize

1. **`APP_NAME`** env var — used in health check, MCP server name, OAuth login page, DB filename
2. **`backend/src/db/database.ts`** — replace the `items` table with your domain schema
3. **`backend/src/index.ts`** — replace example `/api/items` routes with your domain routes
4. **`backend/src/mcp/tools.ts`** — replace example tools with your domain MCP tools
5. **`frontend/src/pages/`** — build your app pages
6. **`frontend/src/api/client.ts`** — add your domain API calls
7. **`frontend/index.html`** — update the `<title>`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes (production) | Session encryption key |
| `APP_NAME` | No | App name (default: `jhabit`) |
| `MCP_SERVER_URL` | For remote MCP | Public URL for OAuth metadata |
| `PORT` | No | Server port (default: `3100`) |
| `FRONTEND_URL` | No | CORS origin for dev (default: `http://localhost:3000`) |

## MCP Setup

1. Set `MCP_SERVER_URL` to your public URL
2. Set up DNS + nginx reverse proxy with SSL (remember `proxy_buffering off` for SSE)
3. Add as custom integration in Claude.ai pointing to `https://your-domain.com/mcp`
4. Authenticate with your app username/password

## Deployment

Push to `main` triggers GitHub Actions → builds Docker image → pushes to GHCR.

On your server:
```bash
docker-compose pull && docker-compose up -d
```

That's it. Same pattern for every app.
