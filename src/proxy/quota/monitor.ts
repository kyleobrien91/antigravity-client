import { AntigravityClient } from "../../core/client.js";

const POLL_INTERVAL_MS = 60 * 1000;

export interface PlanInfo {
    planName: string;
    tierId: string;
    tierName: string;
}

export interface CreditInfo {
    promptAvailable: number;
    promptTotal: number;
    promptUsedPct: number;
    flowAvailable: number;
    flowTotal: number;
    flowUsedPct: number;
    flexPurchasable: number;
    canBuyMore: boolean;
}

export interface ModelQuota {
    label: string;
    modelId: string;
    remainingFraction: number;
    remainingPct: number;
    resetTime: string;
    resetInSecs: number;
    resetInHuman: string;
}

export interface QuotaSnapshot {
    lastUpdated: string;
    plan: PlanInfo;
    credits: CreditInfo;
    models: ModelQuota[];
}

export class QuotaMonitor {
    private client: AntigravityClient;
    private currentSnapshot: QuotaSnapshot | null = null;
    private timer: NodeJS.Timeout | null = null;

    constructor(client: AntigravityClient) {
        this.client = client;
    }

    public getSnapshot(): QuotaSnapshot | null {
        return this.currentSnapshot;
    }

    public start() {
        if (this.timer) return;
        this.poll();
    }

    public stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private async poll() {
        try {
            // Apply Gaussian jitter for stealth timing (±500ms)
            const jitter = (Math.random() - 0.5) * 1000;
            const nextPollTime = POLL_INTERVAL_MS + jitter;

            await this.updateSnapshot();

            this.timer = setTimeout(() => this.poll(), nextPollTime);
        } catch (error) {
            // Silently suppress errors according to instructions
            const jitter = (Math.random() - 0.5) * 1000;
            const nextPollTime = POLL_INTERVAL_MS + jitter;
            this.timer = setTimeout(() => this.poll(), nextPollTime);
        }
    }

    public async updateSnapshot() {
        // Wrap the network call in a timeout race just in case
        let timeoutHandle: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error("Timeout")), 10000);
        });

        try {
            const [statusResponse, cascadeConfigResponse] = await Promise.race([
                Promise.all([
                    this.client.getUserStatus(),
                    this.client.getCascadeModelConfigData()
                ]),
                timeoutPromise as Promise<[any, any]>
            ]);

            if (!statusResponse || !statusResponse.userStatus) {
                return;
            }

            const now = new Date();
            const userStatus = statusResponse.userStatus;
            const planStatus = userStatus.planStatus;
            const planInfo = planStatus?.planInfo || userStatus.planInfo;
            const userTier = userStatus.userTier;

            const promptTotal = planInfo?.monthlyPromptCredits || 0;
            const promptAvail = planStatus?.availablePromptCredits || 0;
            const flowTotal = planInfo?.monthlyFlowCredits || 0;
            const flowAvail = planStatus?.availableFlowCredits || 0;

            const promptUsedPct = promptTotal > 0 ? ((promptTotal - promptAvail) / promptTotal) * 100.0 : 0.0;
            const flowUsedPct = flowTotal > 0 ? ((flowTotal - flowAvail) / flowTotal) * 100.0 : 0.0;

            const clientModelConfigs = cascadeConfigResponse?.clientModelConfigs || userStatus.cascadeModelConfigData?.clientModelConfigs || [];

            const models: ModelQuota[] = clientModelConfigs.map((m: any) => {
                const label = m.label || "";
                const modelId = m.modelOrAlias?.value?.toString() || "";
                const frac = m.quotaInfo?.remainingFraction || 0.0;

                // Handle Timestamp parsing
                let resetStr = "";
                let resetInSecs = 0;
                let resetInHuman = "available";

                if (m.quotaInfo?.resetTime) {
                    // Convert protobuf timestamp to Date
                    const resetTimeMs = Number(m.quotaInfo.resetTime.seconds) * 1000 + m.quotaInfo.resetTime.nanos / 1e6;
                    const resetDate = new Date(resetTimeMs);
                    resetStr = resetDate.toISOString();

                    resetInSecs = Math.floor((resetDate.getTime() - now.getTime()) / 1000);

                    if (resetInSecs > 0) {
                        const h = Math.floor(resetInSecs / 3600);
                        const min = Math.floor((resetInSecs % 3600) / 60);
                        resetInHuman = `${h}h ${min}m`;
                    } else {
                        resetInSecs = 0;
                    }
                }

                return {
                    label,
                    modelId,
                    remainingFraction: frac,
                    remainingPct: frac * 100.0,
                    resetTime: resetStr,
                    resetInSecs,
                    resetInHuman,
                };
            });

            this.currentSnapshot = {
                lastUpdated: now.toISOString(),
                plan: {
                    planName: planInfo?.planName || "",
                    tierId: userTier?.id || "",
                    tierName: userTier?.name || "",
                },
                credits: {
                    promptAvailable: promptAvail,
                    promptTotal: promptTotal,
                    promptUsedPct,
                    flowAvailable: flowAvail,
                    flowTotal: flowTotal,
                    flowUsedPct,
                    flexPurchasable: planInfo?.monthlyFlexCreditPurchaseAmount || 0,
                    canBuyMore: planInfo?.canBuyMoreCredits || false,
                },
                models,
            };
        } finally {
            clearTimeout(timeoutHandle!);
        }
    }
}
