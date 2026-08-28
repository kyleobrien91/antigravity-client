import { test } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { AntigravityClient } from '../src/core/client.js';
import { startProxyServer } from '../src/proxy/server.js';
import { QuotaMonitor, QuotaSnapshot } from '../src/proxy/quota/monitor.js';
import { GetUserStatusResponse } from '../src/gen/exa/language_server_pb/language_server_pb.js';
import { UserStatus, PlanStatus, PlanInfo, CascadeModelConfigData, ClientModelConfig } from '../src/gen/exa/codeium_common_pb/codeium_common_pb.js';

// Mock the client for the test
class MockAntigravityClient extends AntigravityClient {
    constructor() {
        super(8080, "mock-token");
    }

    override async getUserStatus(): Promise<GetUserStatusResponse> {
        return new GetUserStatusResponse({
            userStatus: new UserStatus({
                planInfo: new PlanInfo({
                    planName: "Pro Tier",
                    monthlyPromptCredits: 1000,
                    monthlyFlowCredits: 500,
                }),
                planStatus: new PlanStatus({
                    availablePromptCredits: 800,
                    availableFlowCredits: 200,
                }),
                cascadeModelConfigData: new CascadeModelConfigData({
                    clientModelConfigs: [
                        new ClientModelConfig({
                            label: "Premium Model",
                            modelOrAlias: { case: "alias", value: 1 },
                            quotaInfo: {
                                remainingFraction: 0.5,
                            }
                        })
                    ]
                })
            })
        });
    }

    override async getCascadeModelConfigData(): Promise<CascadeModelConfigData> {
        return new CascadeModelConfigData({
            clientModelConfigs: [
                new ClientModelConfig({
                    label: "Premium Model",
                    modelOrAlias: { case: "alias", value: 1 },
                    quotaInfo: {
                        remainingFraction: 0.5,
                    }
                })
            ]
        });
    }
}

test('Proxy server returns quota snapshot via /v1/quota', async () => {
    const mockClient = new MockAntigravityClient();
    const monitor = new QuotaMonitor(mockClient);

    // Force an initial update to populate snapshot
    await (monitor as any).updateSnapshot();

    const port = 8999;
    const server = startProxyServer({ port, client: mockClient, quotaMonitor: monitor });

    try {
        const responseData = await new Promise<string>((resolve, reject) => {
            http.get(`http://localhost:${port}/v1/quota`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });

        const snapshot: QuotaSnapshot = JSON.parse(responseData);

        assert.ok(snapshot.lastUpdated, "Missing lastUpdated");
        assert.equal(snapshot.plan.planName, "Pro Tier", "Plan name mismatch");
        assert.equal(snapshot.credits.promptAvailable, 800, "Prompt available mismatch");
        assert.equal(snapshot.credits.promptTotal, 1000, "Prompt total mismatch");
        assert.equal(snapshot.credits.promptUsedPct, 20, "Prompt used pct mismatch"); // (1000-800)/1000 * 100 = 20
        assert.equal(snapshot.credits.flowAvailable, 200, "Flow available mismatch");
        assert.equal(snapshot.credits.flowTotal, 500, "Flow total mismatch");
        assert.equal(snapshot.credits.flowUsedPct, 60, "Flow used pct mismatch"); // (500-200)/500 * 100 = 60

        assert.equal(snapshot.models.length, 1, "Models length mismatch");
        assert.equal(snapshot.models[0].label, "Premium Model", "Model label mismatch");
        assert.equal(snapshot.models[0].remainingFraction, 0.5, "Model remaining fraction mismatch");
        assert.equal(snapshot.models[0].remainingPct, 50, "Model remaining pct mismatch");
    } finally {
        server.close();
        monitor.stop();
    }
});
