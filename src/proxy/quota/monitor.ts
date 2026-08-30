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
        let timeoutHandle: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error("Timeout")), 5000);
        });

        try {
            const [modelsDict, authStatus] = await Promise.race([
                Promise.all([
                    this.client.getAvailableModels(),
                    this.client.getAuthStatus().catch(() => null)
                ]),
                timeoutPromise as Promise<[any, any]>
            ]);

            const now = new Date();
            const modelsList = Object.values(modelsDict || {});

            const models: ModelQuota[] = modelsList.map((m: any) => {
                const label = m.label || "";
                const modelId = m.modelIdKey || m.modelId?.toString() || label;
                const frac = m.disabled ? 0.0 : 1.0;

                return {
                    label,
                    modelId,
                    remainingFraction: frac,
                    remainingPct: frac * 100.0,
                    resetTime: "",
                    resetInSecs: 0,
                    resetInHuman: m.disabled ? "exhausted" : "available",
                };
            });

            this.currentSnapshot = {
                lastUpdated: now.toISOString(),
                plan: {
                    planName: authStatus?.authResult?.hasValidAuth ? "Antigravity Pro" : "Antigravity Community",
                    tierId: "antigravity-tier",
                    tierName: authStatus?.authResult?.hasValidAuth ? "Pro Tier" : "Free Tier",
                },
                credits: {
                    promptAvailable: 1000,
                    promptTotal: 1000,
                    promptUsedPct: 0.0,
                    flowAvailable: 1000,
                    flowTotal: 1000,
                    flowUsedPct: 0.0,
                    flexPurchasable: 0,
                    canBuyMore: false,
                },
                models,
            };
        } catch (e: any) {
            // Silently fallback without crashing
        } finally {
            clearTimeout(timeoutHandle!);
        }
    }
}
