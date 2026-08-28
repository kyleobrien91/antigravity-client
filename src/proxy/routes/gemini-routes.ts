import type { IncomingMessage, ServerResponse } from 'http';
import type { AntigravityClient } from '../../core/client.js';
import { resolveModel } from '../aliases.js';
import { obfuscatePayload } from '../stealth/obfuscator.js';

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
    
    const resolvedModel = resolveModel(modelId);

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
    const reqPromise = cascade.sendMessage(promptText, { model: resolvedModel });

    if (isStream) {
        cascade.on('text', (ev: any) => {
            const chunk = {
                candidates: [{ content: { parts: [{ text: ev.delta }] } }]
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        });

        await reqPromise;
        res.end();
    } else {
        let fullText = '';
        cascade.on('text', (ev: any) => { fullText += ev.delta; });
        await reqPromise;

        const response = {
            candidates: [
                { content: { parts: [{ text: fullText }], role: 'model' } }
            ]
        };
        res.end(JSON.stringify(response));
    }
}
