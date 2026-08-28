import type { IncomingMessage, ServerResponse } from 'http';
import type { AntigravityClient } from '../../core/client.js';
import { resolveModel, loadAliases } from '../aliases.js';
import { transformPrompt } from '../stealth/prompt-modes.js';
import { obfuscatePayload } from '../stealth/obfuscator.js';

export async function handleOpenAIRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    body: any, 
    client: AntigravityClient,
    path: string
) {
    if (path === '/v1/models') {
        const models = await client.getAvailableModels();
        const aliases = loadAliases();
        const data = Object.keys(models).map(id => ({ id, object: 'model' }));
        for (const alias of Object.keys(aliases)) {
            data.push({ id: alias, object: 'model' });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data }));
        return;
    }

    if (path === '/v1/chat/completions') {
        const model = resolveModel(body.model || 'gemini-3-flash');
        
        // Apply stealth/obfuscation pipeline
        const messages = obfuscatePayload(transformPrompt(body.messages || []));
        
        res.writeHead(200, {
            'Content-Type': body.stream ? 'text/event-stream' : 'application/json',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Initialize Cascade
        const cascade = await client.startCascade();
        
        const lastMessage = messages[messages.length - 1]?.content || '';
        const reqPromise = cascade.sendMessage(lastMessage, { model });

        if (body.stream) {
            cascade.on('text', (ev: any) => {
                const chunk = {
                    id: cascade.cascadeId,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: body.model,
                    choices: [{ delta: { content: ev.delta }, index: 0, finish_reason: null }]
                };
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            });

            await reqPromise;
            res.write(`data: [DONE]\n\n`);
            res.end();
        } else {
            let fullText = '';
            cascade.on('text', (ev: any) => { fullText += ev.delta; });
            await reqPromise;

            const response = {
                id: cascade.cascadeId,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: body.model,
                choices: [{
                    message: { role: 'assistant', content: fullText },
                    finish_reason: 'stop',
                    index: 0
                }]
            };
            res.end(JSON.stringify(response));
        }
        return;
    }

    res.writeHead(404);
    res.end();
}
