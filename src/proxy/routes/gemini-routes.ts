import type { IncomingMessage, ServerResponse } from 'http';
import type { AntigravityClient } from '../../core/client.js';
import { resolveModel } from '../aliases.js';
import { obfuscatePayload } from '../stealth/obfuscator.js';
import { TraceCollector } from '../stealth/trace.js';

export async function handleGeminiRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    body: any, 
    client: AntigravityClient,
    path: string
) {
    // Expected path: /v1beta/models/gemini-3-flash:generateContent
    // or streamGenerateContent
    const isStream = path.includes('streamGenerateContent');
    const modelMatch = path.match(/\/models\/([^:]+)/);
    const modelId = modelMatch ? modelMatch[1] : 'gemini-3-flash';
    
    if (!body || !body.contents || !Array.isArray(body.contents) || body.contents.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: "Invalid request body: 'contents' must be a non-empty array." } }));
        return;
    }

    const resolvedModel = resolveModel(modelId);

    const userText = Array.isArray(body.contents) ? body.contents.map((c: any) => c.parts?.map((p: any) => p.text || '').join('') || '').join('\n') : '';
    const trace = new TraceCollector(path, '', modelId, isStream, {
        message_count: Array.isArray(body.contents) ? body.contents.length : 0,
        tool_count: Array.isArray(body.tools) ? body.tools.length : 0,
        tool_round_count: 0,
        user_text_len: userText.length,
        user_text_preview: userText.substring(0, 50),
        system_prompt: !!body.systemInstruction,
        has_image: userText.includes('inlineData')
    });

    // Obfuscate the contents
    const contents = obfuscatePayload(body.contents || []);
    
    // In Gemini native, the prompt is just the last user parts text
    const lastContent = contents[contents.length - 1];
    const promptText = lastContent?.parts?.map((p: any) => p.text).join('\n') || '';

    res.writeHead(200, {
        'Content-Type': isStream ? 'text/event-stream' : 'application/json',
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

    const reqPromise = cascade.sendMessage(promptText, { model: resolvedModel });

    try {
        if (isStream) {
            cascade.on('text', (ev: any) => {
                const chunk = {
                    candidates: [{ content: { parts: [{ text: ev.delta }] } }]
                };
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            });

            await reqPromise;
            isCompleted = true;
            trace.addTurn({ turn: 1, mitm_matched: true, response: { text_len: 0, thinking_len: 0, finish_reason: 'STOP', grounding: false } });
            await trace.finishAndWrite('success');
            res.end();
        } else {
            let fullText = '';
            cascade.on('text', (ev: any) => { fullText += ev.delta; });
            await reqPromise;
            isCompleted = true;

            trace.addTurn({ turn: 1, mitm_matched: true, response: { text_len: fullText ? fullText.length : 0, thinking_len: 0, text_preview: fullText ? fullText.substring(0, 50) : '', finish_reason: 'STOP', grounding: false } });
            trace.setUsage({ input_tokens: 0, output_tokens: fullText ? Math.ceil(fullText.length / 4) : 0, thinking_tokens: 0, cache_read: 0 });
            await trace.finishAndWrite('success');

            const response = {
                candidates: [
                    { content: { parts: [{ text: fullText }], role: 'model' } }
                ]
            };
            res.end(JSON.stringify(response));
        }
    } catch (err: any) {
        trace.addError(err?.message || String(err));
        await trace.finishAndWrite('error');
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: err?.message || 'Internal Server Error' } }));
        } else if (isStream) {
            res.write(`data: ${JSON.stringify({ error: { message: err?.message || String(err) } })}\n\n`);
            res.end();
        }
    }
}
