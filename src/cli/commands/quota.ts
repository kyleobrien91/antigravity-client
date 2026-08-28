import { AntigravityClient } from "../../core/client.js";
import { QuotaMonitor } from "../../proxy/quota/monitor.js";

export async function runQuota() {
    console.log("🔌 Connecting to Antigravity Language Server...");
    try {
        const client = await AntigravityClient.connect();
        const monitor = new QuotaMonitor(client);

        console.log("📡 Fetching Quota Information...");

        await monitor.updateSnapshot();
        const snapshot = monitor.getSnapshot();

        if (snapshot && snapshot.plan) {
            console.log("--------------------------------------------------");
            console.log(`📊 Quota / Plan Status:`);
            console.log(`   Tier          : ${snapshot.plan.planName || "Unknown"} (${snapshot.plan.tierName || "Unknown"})`);
            console.log(`   Prompt Credits: ${snapshot.credits.promptAvailable} / ${snapshot.credits.promptTotal} (${snapshot.credits.promptUsedPct.toFixed(2)}% used)`);
            console.log(`   Flow Credits  : ${snapshot.credits.flowAvailable} / ${snapshot.credits.flowTotal} (${snapshot.credits.flowUsedPct.toFixed(2)}% used)`);

            console.log(`\n🤖 Per-Model Quotas:`);
            for (const m of snapshot.models) {
                console.log(`   - ${m.label} (${m.modelId}):`);
                console.log(`       Remaining: ${m.remainingPct.toFixed(2)}%`);
                console.log(`       Reset    : ${m.resetInHuman}`);
            }
            console.log("--------------------------------------------------");
        } else {
            console.log("ℹ️ No Plan/Quota Information available.");
        }

        client.dispose();
    } catch (e: unknown) {
        console.error("❌ Quota fetch failed:", (e as Error).message);
    }
}
