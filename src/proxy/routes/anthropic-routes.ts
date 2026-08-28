import type { IncomingMessage, ServerResponse } from 'http';
import type { AntigravityClient } from '../../core/client.js';
import { resolveModel } from '../aliases.js';
import { transformPrompt } from '../stealth/prompt-modes.js';
import { obfuscatePayload } from '../stealth/obfuscator.js';

export async function handleAnthropicRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    body: any, 
    client: AntigravityClient,
    path: string
) {
    if (path === '/v1/messages') {
        const model = resolveModel(body.model || 'opus-4.6');
        
        // Anthropic system prompt can be top-level `system` property
        let systemPrompt = typeof body.system === 'string' ? body.system : '';
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
        
        // Get the last user message text
        const lastMessage = transformedMessages.filter((m: any) => m.role === 'user').pop()?.content || '';
        const reqPromise = cascade.sendMessage(typeof lastMessage === 'string' ? lastMessage : JSON.stringify(lastMessage), { model });

        if (body.stream) {
            // Anthropic stream format
            res.write(`event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { id: cascade.cascadeId, role: 'assistant', model: body.model } })}\n\n`);
            
            cascade.on('text', (ev: any) => {
                res.write(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ev.delta } })}\n\n`);
            });

            await reqPromise;
            res.write(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
            res.end();
        } else {
            let fullText = '';
            cascade.on('text', (ev: any) => { fullText += ev.delta; });
            await reqPromise;

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
        return;
    }

    res.writeHead(404);
    res.end();
}
