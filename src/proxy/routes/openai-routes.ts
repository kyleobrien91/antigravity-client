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
        const seen = new Set<string>();
        const data: any[] = [];

        for (const info of Object.values(models)) {
            if (seen.has(info.label)) continue;
            seen.add(info.label);

            data.push({
                id: info.label,
                object: 'model',
                created: 1700000000,
                owned_by: info.provider?.toLowerCase() || 'google',
                permission: [],
                root: info.label,
                parent: null,
                is_premium: !!info.isPremium,
                is_recommended: !!info.isRecommended,
                disabled: !!info.disabled,
                supports_images: !!info.supportsImages,
                supports_thinking: !!info.supportsThinking,
                thinking_budget: info.thinkingBudget,
                max_tokens: info.maxTokens,
                max_output_tokens: info.maxOutputTokens,
                quota_tier: info.quotaTier || undefined,
                tag_title: info.tagTitle || undefined,
                tag_description: info.tagDescription || undefined,
                description: info.description || '',
                credit_multiplier: info.creditMultiplier ?? 1,
                model_enum: info.model,
                model_id: info.modelId,
                model_id_key: info.modelIdKey,
                alias: info.alias,
            });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data }));
        return;
    }

    if (path === '/v1/chat/completions') {
        if (!body || !body.messages || !Array.isArray(body.messages) || body.messages.length === 0 || !body.model) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: "Invalid request body: 'messages' must be a non-empty array and 'model' is required." } }));
            return;
        }

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
        
        let isCompleted = false;
        const cancelCascade = () => {
            if (!isCompleted) {
                cascade.cancel().catch(e => console.error("Failed to cancel cascade:", e));
            }
        };
        req.on('close', cancelCascade);
        req.on('aborted', cancelCascade);

        const lastMessage = messages[messages.length - 1]?.content || '';
        while(cascade.state && cascade.state.status === 0 /* UNSPECIFIED */) { await new Promise(r => setTimeout(r, 50)); }
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
                isCompleted = true;
                trace.addTurn({ turn: 1, mitm_matched: true, response: { text_len: 0, thinking_len: 0, finish_reason: 'stop', grounding: false } });
                await trace.finishAndWrite('success');
                res.write(`data: [DONE]\n\n`);
                res.end();
            } else {
                let fullText = '';
                cascade.on('text', (ev: any) => { fullText += ev.delta; });
                await reqPromise;
                isCompleted = true;

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
            } else if (body.stream) {
                res.write(`data: ${JSON.stringify({ error: { message: err?.message || String(err) } })}\n\n`);
                res.end();
            }
        }
        return;
    }


    if (path === '/v1/responses') {
        const model = resolveModel(body.model || 'gemini-3-flash');
        const userText = Array.isArray(body.messages) ? body.messages.filter((m: any) => m.role === 'user').map((m: any) => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n') : '';
        const systemPrompt = Array.isArray(body.messages) ? body.messages.some((m: any) => m.role === 'system') : false;

        const trace = new TraceCollector('/v1/responses', '', body.model || 'gemini-3-flash', !!body.stream, {
            message_count: Array.isArray(body.messages) ? body.messages.length : 0,
            tool_count: Array.isArray(body.tools) ? body.tools.length : 0,
            tool_round_count: 0,
            user_text_len: userText.length,
            user_text_preview: userText.substring(0, 50),
            system_prompt: systemPrompt,
            has_image: userText.includes('image_url')
        });

        const messages = obfuscatePayload(transformPrompt(body.messages || []));

        res.writeHead(200, {
            'Content-Type': body.stream ? 'text/event-stream' : 'application/json',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        let cascade;
        if (body.previous_response_id) {
            cascade = await client.resumeCascade(body.previous_response_id);
        } else {
            cascade = await client.startCascade();
        }
        trace.setCascadeId(cascade.cascadeId);

        // Critical Cleanup
        let isCompleted = false;
        const cancelCascade = () => {
            if (!isCompleted) {
                cascade.cancel().catch(e => console.error("Failed to cancel cascade:", e));
            }
        };
        req.on('close', cancelCascade);
        req.on('aborted', cancelCascade);

        const lastMessage = messages[messages.length - 1]?.content || '';
        while(cascade.state && cascade.state.status === 0 /* UNSPECIFIED */) { await new Promise(r => setTimeout(r, 50)); }
        const reqPromise = cascade.sendMessage(lastMessage, { model });

        try {
            if (body.stream) {
                // Stage 1: response.created
                res.write(`data: ${JSON.stringify({ type: 'response.created', response: { id: cascade.cascadeId } })}\n\n`);

                // Stage 2: response.output_item.added
                res.write(`data: ${JSON.stringify({ type: 'response.output_item.added', item: { id: 'item_1', type: 'message' } })}\n\n`);

                let firstChunk = true;
                cascade.on('text', (ev: any) => {
                    if (firstChunk) {
                        // Stage 3: response.content_part.added
                        res.write(`data: ${JSON.stringify({ type: 'response.content_part.added', part: { type: 'text' } })}\n\n`);
                        firstChunk = false;
                    }
                    // Stage 4: response.output_text.delta
                    res.write(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: ev.delta })}\n\n`);
                });

                await reqPromise;
                isCompleted = true;

                if (firstChunk) {
                     res.write(`data: ${JSON.stringify({ type: 'response.content_part.added', part: { type: 'text' } })}\n\n`);
                }

                // Stage 5: response.content_part.done
                res.write(`data: ${JSON.stringify({ type: 'response.content_part.done' })}\n\n`);

                // Stage 6: response.output_item.done
                res.write(`data: ${JSON.stringify({ type: 'response.output_item.done' })}\n\n`);

                // Stage 7: response.completed
                res.write(`data: ${JSON.stringify({ type: 'response.completed' })}\n\n`);

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
                    object: 'response',
                    output: fullText
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
                res.write(`data: ${JSON.stringify({ type: 'response.failed', error: { message: err?.message || String(err) } })}\n\n`);
                res.end();
            }
        }
        return;
    }

    res.writeHead(404);
    res.end();
}
