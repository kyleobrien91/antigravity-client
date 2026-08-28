import { describe, it, before, after } from "node:test";
import * as assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { MockExtensionServer } from "../src/server/mock-extension-server.js";
import { createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { ExtensionServerService } from "../src/gen/exa/extension_server_pb/extension_server_connect.js";
import { WriteCascadeEditRequest } from "../src/gen/exa/extension_server_pb/extension_server_pb.js";
import { pathToFileURL } from "url";

describe("SaveDocument and WriteCascadeEdit", () => {
    let mockExtServer: MockExtensionServer;
    let port: number;
    let client: ReturnType<typeof createPromiseClient>;

    const testDir = path.join(os.tmpdir(), "antigravity-test-save-doc");

    before(async () => {
        mockExtServer = new MockExtensionServer({ verbose: true });
        port = await mockExtServer.start();

        const transport = createConnectTransport({
            httpVersion: "1.1",
            baseUrl: `http://127.0.0.1:${port}`
        });

        // Use type assertion if necessary, but inference is generally fine
        client = createPromiseClient(ExtensionServerService as any, transport);

        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    after(async () => {
        await mockExtServer.stop();
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("should write file to disk via WriteCascadeEdit", async () => {
        const testFile = path.join(testDir, "test_file.txt");
        const uri = pathToFileURL(testFile).href;
        const targetContent = "Hello from Antigravity!";

        const req = new WriteCascadeEditRequest({
            uri,
            targetContent
        });

        await client.writeCascadeEdit(req);

        // Verify the file was written
        assert.ok(fs.existsSync(testFile), "File should have been created");
        const content = fs.readFileSync(testFile, "utf-8");
        assert.strictEqual(content, targetContent, "File content should match the targetContent");
    });

    it("should handle error when writing to a restricted path gracefully", async () => {
        // Find a restricted path, e.g. root directory on linux or C:\ on windows
        const restrictedDir = process.platform === "win32" ? "C:\\System Volume Information\\restricted" : "/root/restricted";
        const restrictedFile = path.join(restrictedDir, "test_file.txt");
        const uri = pathToFileURL(restrictedFile).href;
        const targetContent = "Should not write this";

        const req = new WriteCascadeEditRequest({
            uri,
            targetContent
        });

        try {
            await client.writeCascadeEdit(req);
            // On some environments, we might actually be root and able to write, but typically it should fail.
            // If it succeeds, we just clean it up.
            if (fs.existsSync(restrictedFile)) {
                fs.rmSync(restrictedFile, { force: true });
            }
        } catch (error: any) {
            // Should be a ConnectError
            assert.strictEqual(error.code, 13 /* Internal */, "Should return Internal error code");
            assert.ok(error.message.includes("Failed to write file"), "Error message should contain 'Failed to write file'");
        }
    });
});
