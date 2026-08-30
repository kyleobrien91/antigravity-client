import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { EventEmitter } from 'events';

import { handleOpenAIRequest } from '../../src/proxy/routes/openai-routes.js';
import { handleAnthropicRequest } from '../../src/proxy/routes/anthropic-routes.js';
import { handleGeminiRequest } from '../../src/proxy/routes/gemini-routes.js';
import { AntigravityClient } from '../../src/core/client.js';

class MockCascade extends EventEmitter {
    cascadeId = 'mock-cascade-id';

    async sendMessage(prompt: string, opts?: any): Promise<void> {
        process.nextTick(() => {
            this.emit('text', { delta: 'Hello world' });
            this.emit('done');
        });
    }

    async cancel(): Promise<void> {
        // Mock cancel
    }
}

class MockClient {
    async startCascade(): Promise<any> {
        return new MockCascade();
    }
    async resumeCascade(id: string): Promise<any> {
        return new MockCascade();
    }
    async getAvailableModels(): Promise<any> {
        return { 'test-model': true };
    }
}

class MockRequest extends EventEmitter {
    headers = {};
    method = 'POST';
}

class MockResponse {
    statusCode = 200;
    headers: Record<string, string> = {};
    body = '';
    headersSent = false;

    writeHead(statusCode: number, headers?: Record<string, string>) {
        this.statusCode = statusCode;
        if (headers) Object.assign(this.headers, headers);
        this.headersSent = true;
    }

    write(data: string) {
        this.body += data;
    }

    end(data?: string) {
        if (data) this.body += data;
    }
}

describe('Route Translation Unit Tests', () => {
    test('OpenAI route translation (non-streaming)', async () => {
        const req = new MockRequest();
        const res = new MockResponse();
        const client = new MockClient() as unknown as AntigravityClient;

        const body = {
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Say hello' }],
            stream: false
        };

        await handleOpenAIRequest(req as any, res as any, body, client, '/v1/chat/completions');

        assert.strictEqual(res.statusCode, 200);
        const resBody = JSON.parse(res.body);
        assert.strictEqual(resBody.object, 'chat.completion');
        assert.strictEqual(resBody.choices[0].message.content, 'Hello world');
    });

    test('Anthropic route translation (non-streaming)', async () => {
        const req = new MockRequest();
        const res = new MockResponse();
        const client = new MockClient() as unknown as AntigravityClient;

        const body = {
            model: 'claude-3-opus',
            messages: [{ role: 'user', content: 'Say hello' }],
            stream: false
        };

        await handleAnthropicRequest(req as any, res as any, body, client, '/v1/messages');

        assert.strictEqual(res.statusCode, 200);
        const resBody = JSON.parse(res.body);
        assert.strictEqual(resBody.type, 'message');
        assert.strictEqual(resBody.content[0].text, 'Hello world');
    });

    test('Gemini route translation (non-streaming)', async () => {
        const req = new MockRequest();
        const res = new MockResponse();
        const client = new MockClient() as unknown as AntigravityClient;

        const body = {
            contents: [{ parts: [{ text: 'Say hello' }] }]
        };

        await handleGeminiRequest(req as any, res as any, body, client, '/v1beta/models/gemini-1.5-pro:generateContent');

        assert.strictEqual(res.statusCode, 200);
        const resBody = JSON.parse(res.body);
        assert.strictEqual(resBody.candidates[0].content.parts[0].text, 'Hello world');
    });
});
