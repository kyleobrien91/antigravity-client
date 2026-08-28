import type { IncomingMessage, ServerResponse } from 'http';
import type { AntigravityClient } from '../../core/client.js';
import { resolveModel, loadAliases } from '../aliases.js';
import { transformPrompt } from '../stealth/prompt-modes.js';
import { obfuscatePayload } from '../stealth/obfuscator.js';
import { TraceCollector } from '../stealth/trace.js';

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
        
        const userText = Array.isArray(body.messages) ? body.messages.filter((m: any) => m.role === 'user').map((m: any) => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n') : '';
        const systemPrompt = Array.isArray(body.messages) ? body.messages.some((m: any) => m.role === 'system') : false;
        const trace = new TraceCollector('/v1/chat/completions', '', body.model || 'gemini-3-flash', !!body.stream, {
            message_count: Array.isArray(body.messages) ? body.messages.length : 0,
            tool_count: Array.isArray(body.tools) ? body.tools.length : 0,
            tool_round_count: 0,
            user_text_len: userText.length,
            user_text_preview: userText.substring(0, 50),
            system_prompt: systemPrompt,
            has_image: userText.includes('image_url')
        });

        // Apply stealth/obfuscation pipeline
        const messages = obfuscatePayload(transformPrompt(body.messages || []));
        
        res.writeHead(200, {
            'Content-Type': body.stream ? 'text/event-stream' : 'application/json',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Initialize Cascade
        const cascade = await client.startCascade();
        trace.setCascadeId(cascade.cascadeId);
        
        const lastMessage = messages[messages.length - 1]?.content || '';
        const reqPromise = cascade.sendMessage(lastMessage, { model });

        try {
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
                trace.addTurn({ turn: 1, mitm_matched: true, response: { text_len: 0, thinking_len: 0, finish_reason: 'stop', grounding: false } });
                await trace.finishAndWrite('success');
                res.write(`data: [DONE]\n\n`);
                res.end();
            } else {
                let fullText = '';
                cascade.on('text', (ev: any) => { fullText += ev.delta; });
                await reqPromise;

                trace.addTurn({ turn: 1, mitm_matched: true, response: { text_len: fullText ? fullText.length : 0, thinking_len: 0, text_preview: fullText ? fullText.substring(0, 50) : '', finish_reason: 'stop', grounding: false } });
                trace.setUsage({ input_tokens: 0, output_tokens: fullText ? Math.ceil(fullText.length / 4) : 0, thinking_tokens: 0, cache_read: 0 });
                await trace.finishAndWrite('success');

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
        } catch (err: any) {
            trace.addError(err?.message || String(err));
            await trace.finishAndWrite('error');
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: err?.message || 'Internal Server Error' } }));
            }
        }
        return;
    }

    res.writeHead(404);
    res.end();
}
