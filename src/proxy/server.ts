import * as http from 'http';
import { AntigravityClient } from '../core/client.js';
import { handleOpenAIRequest } from './routes/openai-routes.js';
import { handleAnthropicRequest } from './routes/anthropic-routes.js';
import { handleGeminiRequest } from './routes/gemini-routes.js';
import { QuotaMonitor } from './quota/monitor.js';

export interface ProxyServerOptions {
    port: number;
    client: AntigravityClient;
    quotaMonitor?: QuotaMonitor;
}

export function startProxyServer(options: ProxyServerOptions) {
    let quotaMonitor = options.quotaMonitor;
    if (!quotaMonitor) {
        quotaMonitor = new QuotaMonitor(options.client);
        quotaMonitor.start();
    }

    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const path = url.pathname;

        try {
            // CORS
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            let body = '';
            for await (const chunk of req) {
                body += chunk;
            }

            const parsedBody = body ? JSON.parse(body) : null;

            if (path === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
            } else if (path === '/v1/quota' || path === '/v1/credits') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                const snapshot = quotaMonitor?.getSnapshot() || {};
                res.end(JSON.stringify(snapshot));
            } else if (path.startsWith('/v1/chat/completions') || path.startsWith('/v1/models')) {
                await handleOpenAIRequest(req, res, parsedBody, options.client, path);
            } else if (path.startsWith('/v1/messages')) {
                await handleAnthropicRequest(req, res, parsedBody, options.client, path);
            } else if (path.startsWith('/v1beta/models/')) {
                await handleGeminiRequest(req, res, parsedBody, options.client, path);
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        } catch (err: any) {
            console.error(`[Proxy] Error handling request ${path}:`, err);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: err.message || 'Internal Server Error' } }));
            }
        }
    });

    server.on('error', (err: any) => {
        console.error(`[Proxy] Server error:`, err.message || err);
    });

    server.listen(options.port, () => {
        console.log(`[Proxy] ZeroGravity API proxy running on http://localhost:${options.port}`);
        console.log(`[Proxy] OpenAI-compatible endpoint: http://localhost:${options.port}/v1`);
        console.log(`[Proxy] Anthropic-compatible endpoint: http://localhost:${options.port}`);
        console.log(`[Proxy] Gemini endpoint: http://localhost:${options.port}/v1beta`);
    });

    return server;
}
