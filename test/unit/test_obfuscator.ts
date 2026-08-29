import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { obfuscateString, obfuscatePayload, DEFAULT_SENSITIVE_WORDS } from '../../src/proxy/stealth/obfuscator.js';

describe('Sensitive Words Obfuscator Unit Tests', () => {
    test('Obfuscates client names with zero-width spaces', () => {
        const input = 'I am running Claude Code with Cursor';
        const output = obfuscateString(input);
        
        assert.ok(output.includes('\u200B'), 'Should insert zero-width spaces');
        assert.ok(!output.includes('Claude Code'), 'Should not contain raw phrase');
        assert.ok(!output.includes('Cursor'), 'Should not contain raw word');
    });

    test('Matches longer multi-word phrases first', () => {
        const input = 'You are Claude Code, please help me';
        const output = obfuscateString(input);
        
        assert.ok(output.includes('\u200B'));
        assert.ok(!output.includes('You are Claude Code'));
    });

    test('Obfuscates DLP secrets and file names', () => {
        const input = 'Check .env.local and id_rsa';
        const output = obfuscateString(input);
        
        assert.ok(output.includes('\u200B'));
        assert.ok(!output.includes('.env.local'));
        assert.ok(!output.includes('id_rsa'));
    });

    test('Deeply obfuscates nested objects and arrays', () => {
        const payload = {
            model: 'gemini-3-flash',
            messages: [
                { role: 'system', content: 'You are Claude Code' },
                { role: 'user', content: 'OpenCode is great' }
            ],
            nested: {
                tool: 'CLIProxyAPI'
            }
        };

        const result = obfuscatePayload(payload);
        assert.ok(!result.messages[0].content.includes('You are Claude Code'));
        assert.ok(result.messages[0].content.includes('\u200B'));
        assert.ok(!result.messages[1].content.includes('OpenCode'));
        assert.ok(!result.nested.tool.includes('CLIProxyAPI'));
    });

    test('Avoids double-obfuscating already obfuscated strings', () => {
        const input = 'Cursor';
        const once = obfuscateString(input);
        const twice = obfuscateString(once);
        assert.strictEqual(once, twice, 'Repeated obfuscation should be idempotent');
    });
});
