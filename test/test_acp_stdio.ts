import * as assert from 'node:assert';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import * as jsonrpc from 'vscode-jsonrpc/node.js';

test('ACP STDIO Server Initialization and Prompting', async () => {
    // Start the server process
    const child = spawn('npx', ['tsx', 'src/cli/ag.ts', 'acp'], { shell: true });

    // Listen for stderr so we don't break stdout
    child.stderr.on('data', () => {});
    child.on('error', () => {});

    const connection = jsonrpc.createMessageConnection(
        new jsonrpc.StreamMessageReader(child.stdout),
        new jsonrpc.StreamMessageWriter(child.stdin)
    );

    connection.listen();

    try {
        // Test initialize
        const initResult: any = await connection.sendRequest('initialize', {});
        assert.ok(initResult, 'initialize response is not ok');
        assert.strictEqual(initResult.protocolVersion, '2.0', 'wrong protocolVersion');
        assert.ok(initResult.capabilities, 'no capabilities');
        assert.strictEqual(initResult.capabilities.auth, true, 'missing auth capability');

        // Test auth/login
        const authResult: any = await connection.sendRequest('auth/login', {});
        assert.ok(authResult !== undefined, 'auth/login response is undefined');

        // Wait briefly just to ensure the auth is done and we can test we get errors properly without LS
        try {
            await connection.sendRequest('session/prompt', { prompt: "test" });
            assert.fail("Should throw since no session started");
        } catch (e: any) {
            assert.strictEqual(e.code, jsonrpc.ErrorCodes.InvalidRequest);
        }

    } finally {
        try {
            connection.dispose();
        } catch {}
        try {
            child.kill();
        } catch {}
    }
});
