import { test, describe, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { AccountsStore } from '../../src/accounts/store.js';

describe('AccountsStore Unit Tests', () => {
    let tmpDir: string;
    let configPath: string;

    before(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-test-accounts-'));
        configPath = path.join(tmpDir, 'accounts.json');
    });

    after(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('Loads default config when file is missing', () => {
        const store = new AccountsStore(configPath);
        const config = store.load();

        assert.ok(config);
        assert.deepStrictEqual(config.accounts, []);
        assert.ok(config.device_fingerprint);
    });

    test('Saves and reloads valid config', () => {
        const store = new AccountsStore(configPath);
        const newConfig = {
            accounts: [
                { id: '1', name: 'Test Account', accessToken: 'token', refreshToken: 'refresh' }
            ],
            active: '1',
            device_fingerprint: 'test-fingerprint'
        };

        store.save(newConfig);

        const loadedConfig = store.load();
        assert.deepStrictEqual(loadedConfig, newConfig);
    });

    test('Adds and updates account by loading and saving', () => {
        const store = new AccountsStore(configPath);
        const config = store.load();
        config.accounts.push({ id: '2', name: 'Added Account', accessToken: 'token2', refreshToken: 'refresh2' });
        store.save(config);

        const loadedConfig = store.load();
        assert.strictEqual(loadedConfig.accounts.length, 2);
        assert.strictEqual(loadedConfig.accounts[1].id, '2');

        loadedConfig.accounts[1].accessToken = 'updatedToken';
        store.save(loadedConfig);

        const updatedConfig = store.load();
        assert.strictEqual(updatedConfig.accounts[1].accessToken, 'updatedToken');
    });

    test('Throws error when file is corrupted JSON', () => {
        const store = new AccountsStore(configPath);
        fs.writeFileSync(configPath, 'invalid json {', 'utf8');

        assert.throws(() => {
            store.load();
        }, SyntaxError);
    });
});
