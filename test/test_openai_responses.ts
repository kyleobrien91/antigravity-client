import * as http from 'http';
import * as assert from 'node:assert';
import test from 'node:test';
import { AntigravityClient } from '../src/index.js';
import { handleOpenAIRequest } from '../src/proxy/routes/openai-routes.js';

test('POST /v1/responses streaming SSE lifecycle', async () => {
    // Create a mock AntigravityClient
    const mockClient = {
        startCascade: async () => {
            return {
                cascadeId: 'mock_cascade_id',
                sendMessage: async (text: string, options: any) => {
                    // Resolve after text events are fired
                    return new Promise((resolve) => setTimeout(resolve, 50));
                },
                cancel: async () => {
                    return Promise.resolve();
                },
                on: (event: string, callback: any) => {
                    if (event === 'text') {
                        setTimeout(() => callback({ delta: 'Hello' }), 10);
                        setTimeout(() => callback({ delta: ' World' }), 20);
                    }
                }
            };
        }
    } as unknown as AntigravityClient;

    const requestBody = {
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Test message' }],
        stream: true
    };

    let responseData = '';
    let responseStatus = 0;
    let headers: Record<string, string> = {};

    const req = {
        on: (event: string, callback: any) => {},
    } as unknown as http.IncomingMessage;

    const res = {
        writeHead: (status: number, h: Record<string, string>) => {
            responseStatus = status;
            headers = h;
        },
        write: (data: string) => {
            responseData += data;
        },
        end: () => {}
    } as unknown as http.ServerResponse;

    await handleOpenAIRequest(req, res, requestBody, mockClient, '/v1/responses');

    assert.strictEqual(responseStatus, 200);
    assert.strictEqual(headers['Content-Type'], 'text/event-stream');

    const expectedEvents = [
        'response.created',
        'response.output_item.added',
        'response.content_part.added',
        'response.output_text.delta',
        'response.output_text.delta',
        'response.content_part.done',
        'response.output_item.done',
        'response.completed'
    ];

    const actualEvents = responseData
        .split('\n\n')
        .filter(line => line.startsWith('data: '))
        .map(line => line.replace('data: ', ''))
        .filter(data => data !== '[DONE]')
        .map(data => JSON.parse(data).type);

    assert.deepStrictEqual(actualEvents, expectedEvents);
});
