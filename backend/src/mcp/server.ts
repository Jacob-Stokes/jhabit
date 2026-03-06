/**
 * Remote MCP server setup with OAuth and Streamable HTTP transport.
 * Mounts OAuth endpoints + MCP endpoint on the Express app.
 */

import { randomUUID } from 'crypto';
import type { Express, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AppOAuthProvider, startOAuthCleanup } from './oauth-provider';
import { createMcpServer } from './tools';

const APP_NAME = process.env.APP_NAME || 'jhabit';
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || `http://localhost:${process.env.PORT || 3100}`;

const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer }>();

export function setupMcpRoutes(app: Express): void {
  const provider = new AppOAuthProvider();
  const issuerUrl = new URL(MCP_SERVER_URL);

  // OAuth routes: /.well-known/*, /register, /authorize, /token, /revoke
  app.use(mcpAuthRouter({
    provider,
    issuerUrl,
    serviceDocumentationUrl: new URL(`${MCP_SERVER_URL}`),
    scopesSupported: [APP_NAME],
    resourceName: `${APP_NAME} MCP`,
  }));

  // OAuth login callback
  app.post('/oauth/callback', (req: Request, res: Response) => {
    const { username, password, client_id, redirect_uri, state, code_challenge, code_challenge_method, scopes, resource } = req.body;

    if (!username || !password) {
      res.status(400).send('Username and password are required');
      return;
    }

    const userId = provider.validateCredentials(username, password);
    if (!userId) {
      const { renderLoginPage } = require('./auth-page');
      const html = renderLoginPage({
        clientId: client_id,
        redirectUri: redirect_uri,
        state: state || '',
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method || 'S256',
        scopes: scopes || '',
        resource: resource || '',
        error: 'Invalid username or password',
      });
      res.setHeader('Content-Type', 'text/html');
      res.status(401).send(html);
      return;
    }

    const code = provider.createAuthorizationCode(
      client_id,
      userId,
      redirect_uri,
      code_challenge,
      code_challenge_method || 'S256',
      scopes || '',
      resource || undefined,
    );

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.toString());
  });

  // MCP endpoint
  const bearerAuth = requireBearerAuth({ verifier: provider });

  app.post('/mcp', bearerAuth, async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res, req.body);
    } else if (!sessionId) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          sessions.set(sid, { transport, server });
        },
      });
      const server = createMcpServer();

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } else {
      res.status(400).json({ error: 'Invalid or expired session' });
    }
  });

  app.get('/mcp', bearerAuth, async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
    } else {
      res.status(400).json({ error: 'Invalid or missing session' });
    }
  });

  app.delete('/mcp', bearerAuth, async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
      sessions.delete(sessionId);
    } else {
      res.status(400).json({ error: 'Invalid or missing session' });
    }
  });

  startOAuthCleanup();

  console.log('MCP remote endpoint mounted at /mcp');
  console.log(`OAuth issuer: ${MCP_SERVER_URL}`);
}
