import { AntigravityClient } from "../src/index.js";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

function getAuthToken(): { token: string; rawUss: string } {
    const scriptPath = path.join(__dirname, "..", "scripts", "get_auth.py");
    const out = execSync(`python "${scriptPath}"`).toString().trim();
    return JSON.parse(out);
}

async function main() {
    const { token, rawUss } = getAuthToken();
    console.log("Found OAuth Token:", token ? token.slice(0, 15) + "..." : "NONE");

    const lsBin = "C:\\Users\\user\\AppData\\Local\\Programs\\Antigravity IDE\\resources\\app\\extensions\\antigravity\\bin\\language_server_windows_x64.exe";
    console.log("LS binary exists:", fs.existsSync(lsBin));

    console.log("🚀 Launching standalone Antigravity Language Server via substrate...");
    const client = await AntigravityClient.launch({
        lsBinaryPath: lsBin,
        workspacePath: "C:\\Users\\user\\.gemini\\antigravity\\scratch\\antigravity-gateway",
        authData: {
            apiKey: token,
            email: "user@example.com",
            name: "User",
            ussOAuth: {
                key: "oauthTokenInfoSentinelKey",
                value: rawUss
            }
        },
        verbose: true
    });

    console.log(`✅ LS running! PID: ${client.launcher.pid}, HTTPS Port: ${client.launcher.httpsPort}`);

    console.log("📡 Querying GetUserStatus...");
    const status = await client.getUserStatus();
    console.log("UserStatus:", status.userStatus?.name, status.userStatus?.email);

    console.log("📡 Querying GetAvailableModels...");
    const models = await client.getAvailableModels();
    console.log("Available models count:", models.models?.length);
    for (const m of (models.models || []).slice(0, 5)) {
        console.log(" - Model:", m.modelName, "| Tag:", m.modelTag, "| Provider:", m.provider);
    }

    console.log("🛑 Stopping launcher...");
    await client.launcher.stop();
    console.log("🏁 Substrate test successful!");
}

main().catch(err => {
    console.error("Substrate test failed:", err);
    process.exit(1);
});
