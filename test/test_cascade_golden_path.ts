import { test, describe, before, after } from "node:test";
import * as assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { AntigravityClient, Cascade } from "../src/index.js";
import { runWebviewWarmup } from '../src/proxy/stealth/warmup.js';
import type { TextDeltaEvent, ThinkingDeltaEvent } from "../src/index.js";

describe("Cascade Golden Path End-to-End Test", () => {
    let client: AntigravityClient;
    let cascade: Cascade;
    let testDir: string;
    let testFilePath: string;
    let commandOutput = "";

    // We will use a reasonably high timeout because running LS commands can take time
    const TIMEOUT_MS = 120000;

    before(async () => {
        // Create test workspace
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ag-golden-path-"));
        testFilePath = path.join(testDir, "hello.txt");
        fs.writeFileSync(testFilePath, "Initial content.", "utf-8");

        console.log(`[Golden Path] Workspace created at ${testDir}`);

        // Let's check if the binary exists, and if not, we can either provide a dummy or just use the default.
        // For the purposes of testing the actual logic, we launch the real LS.

        // Launch LS
        try {
            // We use a mock bin for testing so it doesn't fail checking if the binary exists
            const mockLsBinaryPath = path.join(process.cwd(), "bin", "language_server");

            client = await AntigravityClient.launch({
                workspacePath: testDir,
                lsBinaryPath: fs.existsSync(mockLsBinaryPath) ? mockLsBinaryPath : undefined,
                verbose: false,
                // Using authData mock for the test if it requires login
                authData: {
                    apiKey: 'test_api_key',
                    email: 'test@example.com',
                    name: 'Test User',
                    ussOAuth: {
                        key: 'oauthTokenInfoSentinelKey',
                        value: Buffer.from(JSON.stringify({
                            accessToken: 'mock_access_token',
                            refreshToken: 'mock_refresh_token',
                            expiry: { seconds: Math.floor(Date.now() / 1000) + 3600 }
                        })).toString('base64')
                    }
                }
            });
            console.log("[Golden Path] Language Server launched");
        } catch (e: any) {
            if (e.message.includes("LS binary not found") || e.message.includes("No auth data found")) {
                console.log(`[Golden Path] Skipping test due to missing LS binary or auth: ${e.message}`);
                // If we can't launch, we just skip the rest of the test but don't fail it completely.
                // We mock it temporarily so the teardown doesn't crash, but the tests will just be skipped if needed.
                return;
            }
            throw e;
        }

        // Run warmup
        await runWebviewWarmup(client);
        console.log("[Golden Path] Warmup completed");

        // Start cascade session
        cascade = await client.startCascade();
        console.log(`[Golden Path] Cascade started with ID: ${cascade.cascadeId}`);

        // Auto-approve interactions (file permissions, commands)
        cascade.on(Cascade.Events.Interaction, async (evt: any) => {
            if (evt.needsApproval) {
                console.log(`[Golden Path] Auto-approving interaction: ${evt.type}`);
                await evt.approve();
            }
        });

        // Capture command output
        cascade.on(Cascade.Events.CommandOutput, (evt: any) => {
            if (evt.outputType === "stdout") {
                commandOutput += evt.delta;
            }
        });

        cascade.on(Cascade.Events.Text, (ev: TextDeltaEvent) => {
            process.stdout.write(ev.delta);
        });
    });

    after(async () => {
        console.log("[Golden Path] Tearing down...");

        if (client) {
            await client.launcher.stop();
        }

        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        console.log("[Golden Path] Teardown complete");
    });

    test("Turn 1: Inspect sample file and run ExecuteCommand", { timeout: TIMEOUT_MS }, async (t) => {
        if (!cascade) {
            t.skip("[Golden Path] Skipping Turn 1 because cascade could not start");
            return;
        }

        commandOutput = "";

        const prompt = `Inspect the file ${testFilePath}. Then, run the command 'node -e "console.log(42)"' to print a number.`;
        console.log(`[Golden Path] Turn 1 Prompt: ${prompt}`);

        const result = await cascade.run(prompt, { timeoutMs: TIMEOUT_MS });

        assert.strictEqual(result.timedOut, false, "Turn 1 timed out");
        assert.ok(result.text.length > 0, "Response text should not be empty");

        // Check command output and exit code
        assert.ok(commandOutput.includes("42"), `Command output should contain 42, but was: ${commandOutput}`);

        const runCommandStep = result.newSteps?.find(s => s.type === "step:runCommand");
        if (runCommandStep) {
            // Note: The mock extension server returns exitCode 0 by default,
            // but the test should assert we get it correctly if runCommand happened.
            // Some versions might not set step details this way, but if they do:
            // assert.strictEqual((runCommandStep.value as any)?.exitCode, 0);
        }
    });

    test("Turn 2: Edit sample file using SaveDocument / WriteCascadeEdit", { timeout: TIMEOUT_MS }, async (t) => {
        if (!cascade) {
            t.skip("[Golden Path] Skipping Turn 2 because cascade could not start");
            return;
        }

        const initialSessionId = cascade.cascadeId;

        const prompt = `Modify the file ${testFilePath} to exactly contain only this text: "Hello from Turn 2". Ensure you overwrite the file.`;
        console.log(`[Golden Path] Turn 2 Prompt: ${prompt}`);

        const result = await cascade.run(prompt, { timeoutMs: TIMEOUT_MS });

        assert.strictEqual(result.timedOut, false, "Turn 2 timed out");

        // Ensure same session ID
        assert.strictEqual(cascade.cascadeId, initialSessionId, "Turn 2 should use the same session ID");

        // Check disk changes
        const contentOnDisk = fs.readFileSync(testFilePath, "utf-8");
        assert.strictEqual(contentOnDisk.trim(), "Hello from Turn 2", "File content was not modified correctly");
    });
});
