import type { IncomingMessage, ServerResponse } from 'http';
import type { AntigravityClient } from '../../core/client.js';
import { resolveModel } from '../aliases.js';
import { transformPrompt } from '../stealth/prompt-modes.js';
import { obfuscatePayload } from '../stealth/obfuscator.js';
import { TraceCollector } from '../stealth/trace.js';

export async function handleAnthropicRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    body: any, 
    client: AntigravityClient,
    path: string
) {
    if (path === '/v1/messages') {
        if (!body || !body.messages || !Array.isArray(body.messages) || body.messages.length === 0 || !body.model) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: "Invalid request body: 'messages' must be a non-empty array and 'model' is required." } }));
            return;
        }

        const model = resolveModel(body.model || 'opus-4.6');
        
        const userText = Array.isArray(body.messages) ? body.messages.filter((m: any) => m.role === 'user').map((m: any) => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n') : '';
        const trace = new TraceCollector('/v1/messages', '', body.model || 'opus-4.6', !!body.stream, {
            message_count: Array.isArray(body.messages) ? body.messages.length : 0,
            tool_count: Array.isArray(body.tools) ? body.tools.length : 0,
            tool_round_count: 0,
            user_text_len: userText.length,
            user_text_preview: userText.substring(0, 50),
            system_prompt: !!body.system,
            has_image: userText.includes('image')
        });

        // Anthropic system prompt can be top-level `system` property
        const systemPrompt = typeof body.system === 'string' ? body.system : '';
        const messages = [...(body.messages || [])];
        if (systemPrompt) {
            messages.unshift({ role: 'system', content: systemPrompt });
        }

        const transformedMessages = obfuscatePayload(transformPrompt(messages));
        
        res.writeHead(200, {
            'Content-Type': body.stream ? 'text/event-stream' : 'application/json',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        const cascade = await client.startCascade();
        trace.setCascadeId(cascade.cascadeId);
        
        let isCompleted = false;
        const cancelCascade = () => {
            if (!isCompleted) {
                cascade.cancel().catch(e => console.error("Failed to cancel cascade:", e));
            }
        };
        req.on('close', cancelCascade);
        req.on('aborted', cancelCascade);

        // Get the last user message text
        const lastMessage = transformedMessages.filter((m: any) => m.role === 'user').pop()?.content || '';
        const reqPromise = cascade.sendMessage(typeof lastMessage === 'string' ? lastMessage : JSON.stringify(lastMessage), { model });

        try {
            if (body.stream) {
                // Anthropic stream format
                res.write(`event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { id: cascade.cascadeId, role: 'assistant', model: body.model } })}\n\n`);

                cascade.on('text', (ev: any) => {
                    res.write(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ev.delta } })}\n\n`);
                });

                await reqPromise;
                isCompleted = true;
                trace.addTurn({ turn: 1, mitm_matched: true, response: { text_len: 0, thinking_len: 0, finish_reason: 'end_turn', grounding: false } });
                await trace.finishAndWrite('success');
                res.write(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
                res.end();
            } else {
                let fullText = '';
                cascade.on('text', (ev: any) => { fullText += ev.delta; });
                await reqPromise;
                isCompleted = true;

                trace.addTurn({ turn: 1, mitm_matched: true, response: { text_len: fullText ? fullText.length : 0, thinking_len: 0, text_preview: fullText ? fullText.substring(0, 50) : '', finish_reason: 'end_turn', grounding: false } });
                trace.setUsage({ input_tokens: 0, output_tokens: fullText ? Math.ceil(fullText.length / 4) : 0, thinking_tokens: 0, cache_read: 0 });
                await trace.finishAndWrite('success');

                const response = {
                    id: cascade.cascadeId,
                    type: 'message',
                    role: 'assistant',
                    model: body.model,
                    content: [{ type: 'text', text: fullText }],
                    stop_reason: 'end_turn',
                    usage: { input_tokens: 0, output_tokens: 0 }
                };
                res.end(JSON.stringify(response));
            }
        } catch (err: any) {
            trace.addError(err?.message || String(err));
            await trace.finishAndWrite('error');
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: err?.message || 'Internal Server Error' } }));
            } else if (body.stream) {
                res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: { type: 'api_error', message: err?.message || String(err) } })}\n\n`);
                res.end();
            }
        }
        return;
    }

    res.writeHead(404);
    res.end();
}
