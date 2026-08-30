
import { createPromiseClient, PromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { Message } from "@bufbuild/protobuf";
import { AutoDetector } from "../utils/autodetect.js";
import { Launcher, type LauncherOptions } from "../server/launcher.js";
import { readAuthStatus } from "../server/auth-reader.js";

// --- Node.js Debug Hack: Make console.log output recursive and clean ---
import util from "util";
const inspectSymbol = Symbol.for("nodejs.util.inspect.custom");
if (typeof process !== "undefined") {
  util.inspect.defaultOptions.depth = null;
  util.inspect.defaultOptions.colors = true;
  util.inspect.defaultOptions.maxArrayLength = null;

  if (Message.prototype as any) {
    (Message.prototype as any)[inspectSymbol] = function () {
      return this.toJson();
    };
  }
}
// -----------------------------------------------------------------------

function resolveApiKey(explicit?: string): string {
    return explicit || process.env.ANTIGRAVITY_API_KEY || readAuthStatus().apiKey || "";
}

// Generated Imports from src/gen
import { LanguageServerService } from "../gen/exa/language_server_pb/language_server_connect.js";
import { Metadata, TextOrScopeItem, ModelOrAlias, Model, ModelAlias, ModelProvider, ConversationalPlannerMode } from "../gen/exa/codeium_common_pb/codeium_common_pb.js";
import { 
    StartCascadeRequest, 
    SendUserCascadeMessageRequest, 
    GetCascadeTrajectoryRequest, 
    GetUserStatusRequest, 
    GetUserStatusResponse, 
    GetCascadeModelConfigDataRequest, 
    GetModelStatusesRequest, 
    GetModelStatusesResponse, 
    GetWorkingDirectoriesResponse, 
    AddTrackedWorkspaceRequest, 
    GetModelResponseRequest, 
    GetAvailableModelsRequest, 
    GetAvailableModelsResponse,
    GetAuthStatusRequest,
    GetAuthStatusResponse,
    HasAuthTokenRequest,
    HasAuthTokenResponse,
    RetrieveUserQuotaSummaryRequest,
    RetrieveUserQuotaSummaryResponse,
    GetServerConfigurationRequest,
    GetServerConfigurationResponse,
    GetGrantedScopesRequest,
    GetGrantedScopesResponse
} from "../gen/exa/language_server_pb/language_server_pb.js";
import { StreamReactiveUpdatesRequest, StreamReactiveUpdatesResponse } from "../gen/exa/reactive_component_pb/reactive_component_pb.js";
import { CascadeConfig, CascadePlannerConfig, CascadeConversationalPlannerConfig, CortexTrajectorySource } from "../gen/exa/cortex_pb/cortex_pb.js";

// Note: UnaryResponse might be needed depending on return types, but let's see what the service returns.
import { CascadeTrajectorySummaries } from "../gen/exa/jetski_cortex_pb/jetski_cortex_pb.js";
import { Cascade } from "./cascade/index.js";
import { ServerInfo } from "../utils/autodetect.js";
import { T } from "../facade/index.js";
import { LanguageServerFacade } from "../facade/services.js";

/**
 * Options for connecting to an existing Antigravity Language Server.
 */
export interface ClientConnectOptions {
  apiKey?: string;
  port?: number;
  csrfToken?: string;
  workspacePath?: string;
  workspaceId?: string;
}

export interface ModelInfo {
  label: string;
  modelIdKey?: string;
  isPremium?: boolean;
  isRecommended: boolean;
  disabled: boolean;
  supportsImages?: boolean;
  supportsThinking?: boolean;
  thinkingBudget?: number;
  maxTokens?: number;
  maxOutputTokens?: number;
  quotaTier?: string;
  tagTitle?: string;
  tagDescription?: string;
  description?: string;
  creditMultiplier?: number;
  provider?: string;
  pricingType?: number;
  model?: string;
  modelId?: number;
  alias?: string;
  aliasId?: number;
}

export interface ClientOptions {
  /**
   * If true, automatically scans running processes to find an active Antigravity Language Server.
   * If false, you MUST provide `port` and `csrfToken` manually.
   * @default true
   */
  autoDetect?: boolean;

  /**
   * The HTTP/HTTPS port the Language Server is listening on.
   * Required if `autoDetect` is false.
   */
  port?: number;

  /**
   * The CSRF token required to authenticate with the Language Server.
   * Required if `autoDetect` is false.
   */
  csrfToken?: string;

  /**
   * Optional. If provided during auto-detection, it will prioritize finding a Language Server
   * that is serving this specific workspace path.
   */
  workspacePath?: string;

  /**
   * Optional. Your Antigravity API key.
   * If not provided, it will try to read from `process.env.ANTIGRAVITY_API_KEY`,
   * and fallback to reading the saved credentials from `~/.codeium/auth.json`.
   */
  apiKey?: string;
}


export { ServerInfo };

export class AntigravityClient {
  private transport;
  public lsClient: PromiseClient<typeof LanguageServerService>;
  private csrfToken: string;
  private apiKey: string;
  public readonly languageServer: LanguageServerFacade;

  // Cached model lookup. Populated lazily on first resolveModelId / resolveDefaultModelId.
  private _modelCache: Record<string, ModelInfo> | null = null;
  private _defaultModelId: number | null = null;
  private activeCascades: Set<Cascade> = new Set();

  private constructor(port: number, csrfToken: string, apiKey: string) {
    this.csrfToken = csrfToken;
    this.apiKey = apiKey;

    // Connect RPC Transport (HTTP/2 + TLS)
    this.transport = createConnectTransport({
      baseUrl: `https://127.0.0.1:${port}`,
      httpVersion: "2",
      nodeOptions: {
        rejectUnauthorized: false,
      },
      interceptors: [
        (next) => async (req) => {
          req.header.set("x-codeium-csrf-token", this.csrfToken);
          return await next(req);
        },
      ],
    });


    this.lsClient = createPromiseClient(LanguageServerService, this.transport);
    this.languageServer = new LanguageServerFacade(this.transport);
  }

  /**
   * Returns all running Language Server processes. (Low-level API)
   */
  static async listServers(): Promise<ServerInfo[]> {
    const detector = new AutoDetector();
    return await detector.findAllServers();
  }

  /**
   * Standard connection method. (High-level API)
   */
  static async connect(options: ClientOptions = {}): Promise<AntigravityClient> {
    let port = options.port;
    let csrfToken = options.csrfToken;
    const apiKey = resolveApiKey(options.apiKey);

    if (!port || !csrfToken) {
        const detector = new AutoDetector();
        if (options.autoDetect !== false) {
          const server = await detector.findBestServer(options.workspacePath);
          port = server.httpsPort || server.httpPort;
          csrfToken = server.csrfToken;
          console.log(`[Client] Connected to LS (PID: ${server.pid}, Port: ${port})`);
        } else {
          throw new Error("Port and CSRF token required when autoDetect is false.");
        }
    }

    return new AntigravityClient(port!, csrfToken!, apiKey);
  }

  /**
   * Connect using a specific ServerInfo object. (Low-level API)
   */
  static async connectWithServer(server: ServerInfo, apiKey?: string): Promise<AntigravityClient> {
     const port = server.httpsPort || server.httpPort;
     const token = server.csrfToken;
     const finalApiKey = resolveApiKey(apiKey);

     if (!port) {
         throw new Error(`Server at PID ${server.pid} does not have a valid port.`);
     }

     return new AntigravityClient(port, token, finalApiKey);
  }

  /**
   * Launch an independent LS and connect to it. (Standalone mode)
   * No running Antigravity IDE required — starts its own LS process.
   *
   * Returns a client with a `launcher` property for lifecycle management.
   * Call `client.launcher.stop()` when done.
   */
  static async launch(options: LauncherOptions = {}): Promise<AntigravityClient & { launcher: Launcher }> {
      const launcher = await Launcher.start(options);
      const apiKey = options.authData?.apiKey || resolveApiKey();
      const client = new AntigravityClient(
          launcher.httpsPort,
          launcher.csrfToken,
          apiKey
      );
      return Object.assign(client, { launcher });
  }

  private getMetadata(): Metadata {
    return new Metadata({
      ideName: "antigravity",
      ideVersion: "1.107.0",
      extensionName: "antigravity",
      extensionVersion: "0.2.0",
      apiKey: this.apiKey,
      locale: "en",
    });
  }

  async getUserStatus(): Promise<GetUserStatusResponse> {
      const response = await this.lsClient.getUserStatus(new GetUserStatusRequest({
          metadata: this.getMetadata(),
      }));
      return response;
  }

  async getAuthStatus(): Promise<GetAuthStatusResponse> {
      const response = await this.lsClient.getAuthStatus(new GetAuthStatusRequest({
          metadata: this.getMetadata(),
      } as any));
      return response;
  }

  async hasAuthToken(): Promise<HasAuthTokenResponse> {
      const response = await this.lsClient.hasAuthToken(new HasAuthTokenRequest({
          metadata: this.getMetadata(),
      } as any));
      return response;
  }

  async retrieveUserQuotaSummary(): Promise<RetrieveUserQuotaSummaryResponse> {
      const response = await this.lsClient.retrieveUserQuotaSummary(new RetrieveUserQuotaSummaryRequest({
          metadata: this.getMetadata(),
      } as any));
      return response;
  }

  async getServerConfiguration(): Promise<GetServerConfigurationResponse> {
      const response = await this.lsClient.getServerConfiguration(new GetServerConfigurationRequest({
          metadata: this.getMetadata(),
      } as any));
      return response;
  }

  async getGrantedScopes(): Promise<GetGrantedScopesResponse> {
      const response = await this.lsClient.getGrantedScopes(new GetGrantedScopesRequest({
          metadata: this.getMetadata(),
      } as any));
      return response;
  }

  async getCascadeModelConfigData(): Promise<import("../gen/exa/codeium_common_pb/codeium_common_pb.js").CascadeModelConfigData> {
      const response = await this.lsClient.getCascadeModelConfigData({
          metadata: this.getMetadata(),
      } as any);
      return response;
  }

  async getModelStatuses(): Promise<GetModelStatusesResponse> {
      const response = await this.lsClient.getModelStatuses({
          metadata: this.getMetadata(),
      } as any);
      return response;
  }

  /**
   * Returns a structured map of available models dynamically discovered via GetAvailableModels RPC,
   * matching the active Antigravity Agentic Hub UI catalog.
   */
  async getAvailableModels(): Promise<Record<string, ModelInfo>> {
      try {
          // Primary RPC used by the Antigravity Agentic Hub UI
          const availableModelsRes = await Promise.race([
              this.lsClient.getAvailableModels(new GetAvailableModelsRequest({ forceRefresh: true })),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
          ]);

          const modelsMap = (availableModelsRes as any).response?.models || [];
          if (Array.isArray(modelsMap) && modelsMap.length > 0) {
              const models: Record<string, ModelInfo> = {};
              for (const entry of modelsMap) {
                  const details = entry.value;
                  const key = entry.key;
                  const label = details?.displayName || key;
                  if (!label) continue;

                  const info: ModelInfo = {
                      label: label,
                      modelIdKey: key,
                      isPremium: details?.quotaInfo?.tier === "High" || details?.quotaInfo?.tier === "Medium",
                      isRecommended: !!details?.recommended,
                      disabled: !!details?.disabled,
                      supportsImages: !!details?.supportsImages,
                      supportsThinking: !!details?.supportsThinking,
                      thinkingBudget: details?.thinkingBudget,
                      maxTokens: details?.maxTokens,
                      maxOutputTokens: details?.maxOutputTokens,
                      quotaTier: details?.quotaInfo?.tier || "",
                      tagTitle: details?.tagTitle || "",
                      tagDescription: details?.tagDescription || "",
                      description: details?.description || "",
                      creditMultiplier: 1,
                      provider: details?.modelProvider !== undefined ? ModelProvider[details.modelProvider] : "GOOGLE",
                      model: details?.model !== undefined ? Model[details.model] : undefined,
                      modelId: details?.model,
                  };

                  models[label] = info;
                  if (key && key !== label) {
                      models[key] = info;
                  }
              }

              if (Object.keys(models).length > 0) {
                  return models;
              }
          }
      } catch (e) {
          // Fall back to UserStatus or static catalog if LS is unauthenticated
      }

      try {
          const userStatus = await Promise.race([
              this.getUserStatus(),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
          ]);
          const configs = userStatus.userStatus?.cascadeModelConfigData?.clientModelConfigs || [];

          if (configs.length > 0) {
              const models: Record<string, ModelInfo> = {};

              configs.forEach((m: any) => {
                  const label = m.label;
                  if (!label) return;

                  const choice = m.modelOrAlias?.choice;

                  const info: ModelInfo = {
                      label: label,
                      isPremium: !!m.isPremium,
                      isRecommended: !!m.isRecommended,
                      disabled: !!m.disabled,
                      supportsImages: !!m.supportsImages,
                      description: m.description || "",
                      creditMultiplier: m.creditMultiplier || 1,
                      provider: m.provider !== undefined ? ModelProvider[m.provider] : undefined,
                      pricingType: m.pricingType,
                  };

                  if (choice) {
                      if (choice.case === "model") {
                          info.model = Model[choice.value];
                          info.modelId = choice.value;
                      } else if (choice.case === "alias") {
                          info.alias = ModelAlias[choice.value];
                          info.aliasId = choice.value;
                      }
                  }

                  models[label] = info;
              });

              if (Object.keys(models).length > 0) {
                  return models;
              }
          }
      } catch (e) {
          // Fall through to agentic hub UI catalog
      }

      // Default active catalog identical to Antigravity Agentic Hub UI
      return {
          "Gemini 3.7 Flash": {
              label: "Gemini 3.7 Flash",
              modelIdKey: "gemini-3.7-flash-high",
              isPremium: false,
              isRecommended: true,
              disabled: false,
              supportsImages: true,
              supportsThinking: true,
              quotaTier: "High",
              tagTitle: "Fast",
              provider: "GOOGLE",
              model: "GOOGLE_GEMINI_2_5_FLASH",
              modelId: Model.GOOGLE_GEMINI_2_5_FLASH
          },
          "Gemini 3.6 Flash": {
              label: "Gemini 3.6 Flash",
              modelIdKey: "gemini-3.6-flash-medium",
              isPremium: false,
              isRecommended: false,
              disabled: false,
              supportsImages: true,
              supportsThinking: true,
              quotaTier: "Medium",
              tagTitle: "Fast",
              provider: "GOOGLE",
              model: "GOOGLE_GEMINI_2_5_FLASH",
              modelId: Model.GOOGLE_GEMINI_2_5_FLASH
          },
          "Gemini 3.5 Flash": {
              label: "Gemini 3.5 Flash",
              modelIdKey: "gemini-3.5-flash-medium",
              isPremium: false,
              isRecommended: false,
              disabled: false,
              supportsImages: true,
              supportsThinking: true,
              quotaTier: "Medium",
              tagTitle: "Fast",
              provider: "GOOGLE",
              model: "GOOGLE_GEMINI_2_5_FLASH_LITE",
              modelId: Model.GOOGLE_GEMINI_2_5_FLASH_LITE
          },
          "Gemini 3.1 Pro": {
              label: "Gemini 3.1 Pro",
              modelIdKey: "gemini-3.1-pro-low",
              isPremium: true,
              isRecommended: false,
              disabled: false,
              supportsImages: true,
              supportsThinking: false,
              quotaTier: "Low",
              provider: "GOOGLE",
              model: "GOOGLE_GEMINI_2_5_PRO",
              modelId: Model.GOOGLE_GEMINI_2_5_PRO
          },
          "Claude Sonnet 4.6 (Thinking)": {
              label: "Claude Sonnet 4.6 (Thinking)",
              modelIdKey: "claude-sonnet-4-6",
              isPremium: true,
              isRecommended: true,
              disabled: false,
              supportsImages: true,
              supportsThinking: true,
              provider: "ANTHROPIC",
              model: "CLAUDE_3_7_SONNET_THINKING",
              modelId: 350
          },
          "Claude Opus 4.6 (Thinking)": {
              label: "Claude Opus 4.6 (Thinking)",
              modelIdKey: "claude-opus-4-6-thinking",
              isPremium: true,
              isRecommended: false,
              disabled: false,
              supportsImages: true,
              supportsThinking: true,
              provider: "ANTHROPIC",
              model: "CLAUDE_3_5_SONNET",
              modelId: 260
          },
          "GPT-OSS 120B (Medium)": {
              label: "GPT-OSS 120B (Medium)",
              modelIdKey: "gpt-oss-120b-medium",
              isPremium: true,
              isRecommended: false,
              disabled: false,
              supportsImages: false,
              supportsThinking: false,
              quotaTier: "Medium",
              provider: "OPENAI",
              model: "CHAT_GPT_4O",
              modelId: 247
          }
      };
  }

  /**
   * Resolve a model identifier to a numeric model id accepted by the LS.
   * Accepts: numeric id (passed through), exact label, enum string, or fuzzy slug.
   */
  async resolveModelId(nameOrId?: number | string): Promise<number> {
      if (typeof nameOrId === "number") return nameOrId;

      if (!this._modelCache) {
          this._modelCache = await this.getAvailableModels();
      }
      const models = this._modelCache;

      // No name given → default
      if (!nameOrId) {
          if (this._defaultModelId !== null) return this._defaultModelId;
          const firstRec = Object.values(models).find(
              (m) => m.isRecommended && !m.disabled && m.modelId !== undefined
          );
          if (firstRec?.modelId !== undefined) {
              this._defaultModelId = firstRec.modelId;
              return firstRec.modelId;
          }
          const firstAvailable = Object.values(models).find(m => !m.disabled && m.modelId !== undefined);
          if (firstAvailable?.modelId !== undefined) {
              this._defaultModelId = firstAvailable.modelId;
              return firstAvailable.modelId;
          }
          throw new Error(
              "resolveModelId: no model available from getAvailableModels(). " +
              "Is the LS reachable and authenticated?"
          );
      }

      // 1. Exact direct key match
      if (models[nameOrId]?.modelId !== undefined) {
          return models[nameOrId].modelId!;
      }

      const target = String(nameOrId).toLowerCase().replace(/[\s\-_()]/g, '');

      // 2. Normalized matching on label, model enum name, or alias
      for (const info of Object.values(models)) {
          if (info.modelId === undefined) continue;

          const labelNorm = info.label.toLowerCase().replace(/[\s\-_()]/g, '');
          if (labelNorm === target) return info.modelId;

          if (info.model) {
              const modelNorm = info.model.toLowerCase().replace(/[\s\-_()]/g, '');
              if (modelNorm === target || modelNorm.replace(/^google|^chat|^model/g, '') === target) {
                  return info.modelId;
              }
          }

          if (info.alias) {
              const aliasNorm = info.alias.toLowerCase().replace(/[\s\-_()]/g, '');
              if (aliasNorm === target) return info.modelId;
          }
      }

      throw new Error(
          `resolveModelId: model "${nameOrId}" not found. ` +
          `Available: ${Object.keys(models).join(", ")}`
      );
  }

  /** Shortcut for resolveModelId() with no argument. */
  async getDefaultModelId(): Promise<number> {
      return this.resolveModelId();
  }

  async getWorkingDirectories(): Promise<GetWorkingDirectoriesResponse> {
      const response = await this.lsClient.getWorkingDirectories({});
      return response;
  }

  /**
   * Explictly tell the Language Server to track a workspace directory.
   */
  async addTrackedWorkspace(workspacePath: string): Promise<void> {
      await this.lsClient.addTrackedWorkspace(new AddTrackedWorkspaceRequest({
          workspace: workspacePath,
          isPassiveWorkspace: false
      }));
  }

  async *getSummariesStream(): AsyncGenerator<StreamReactiveUpdatesResponse, void, unknown> {
      const stream = this.lsClient.streamCascadeSummariesReactiveUpdates(
          new StreamReactiveUpdatesRequest({
              protocolVersion: 1,
              id: "summaries",
          })
      );

      for await (const res of stream) {
          if (res.diff) {
              const state = new CascadeTrajectorySummaries();
              // Note: Ideally we should accumulate state, but for a quick check we'll return the diff-applied empty state
              // Or better, let the caller handle state accumulation if they want full sync.
              // For now, let's yield the raw diff for the test script to handle, or apply it to a fresh object.
              // Given applyMessageDiff is not a method of the client, we might want to just yield the response and let the caller handle it.
              // But to be consistent with getCascade, let's yield the raw response for now.
              yield res;
          }
      }
  }

  async startCascade(): Promise<Cascade> {
      const metadata = new Metadata({
          apiKey: this.apiKey,
          ideName: "vscode",
          ideVersion: "1.107.0",
          extensionName: "antigravity",
          extensionVersion: "0.2.0",
      });

      const req = new StartCascadeRequest({
          metadata,
          source: CortexTrajectorySource.CASCADE_CLIENT,
      });

      const { cascadeId } = await this.lsClient.startCascade(req);
      const cascade = new Cascade(
          cascadeId,
          this.lsClient,
          this.apiKey,
          (nameOrId) => this.resolveModelId(nameOrId),
      );

      this.activeCascades.add(cascade);

      // Auto-start listening in background
      cascade.listen();

      return cascade;
  }

  async getMcpServerStates(): Promise<import("../gen/exa/language_server_pb/language_server_pb.js").GetMcpServerStatesResponse> {
      return this.lsClient.getMcpServerStates({});
  }

  async refreshMcpServers(): Promise<import("../gen/exa/language_server_pb/language_server_pb.js").RefreshMcpServersResponse> {
      return this.lsClient.refreshMcpServers({});
  }

  /**
   * Resumes an existing cascade by ID. Does NOT verify that the cascade is alive.
   * Use `resumeCascade(id)` if you need a guaranteed-live cascade.
   */
  getCascade(cascadeId: string): Cascade {
      const cascade = new Cascade(
          cascadeId,
          this.lsClient,
          this.apiKey,
          (nameOrId) => this.resolveModelId(nameOrId),
      );
      this.activeCascades.add(cascade);
      cascade.listen();
      return cascade;
  }

  /**
   * Cleans up all active cascade update streams and listener resources.
   * Call this before stopping the Language Server process (e.g. client.launcher.stop()).
   */
  dispose(): void {
      for (const cascade of this.activeCascades) {
          try {
              cascade.dispose();
          } catch (e) {
              // ignore errors during individual cascade disposal
          }
      }
      this.activeCascades.clear();
  }

  /**
   * Resumes an existing cascade and verifies it's still alive on the LS side by
   * calling `getHistory()`. Throws a clear error if the cascade is missing,
   * expired, or unreachable.
   */
  async resumeCascade(cascadeId: string): Promise<Cascade> {
      const cascade = this.getCascade(cascadeId);
      try {
          const history = await cascade.getHistory();
          if (!history?.trajectory) {
              throw new Error("Cascade returned no trajectory (possibly expired).");
          }
      } catch (e: any) {
          throw new Error(
              `resumeCascade: failed to resume cascade "${cascadeId}": ${e?.message ?? e}`
          );
      }
      return cascade;
  }

  /**
   * Sends a simple prompt to the model and gets a string response.
   * This is a quick and direct way to get an AI response without starting a cascade.
   *
   * @param prompt The prompt string to send to the AI.
   * @param model An optional model enum value (defaults to Model.UNSPECIFIED).
   * @returns The AI's response string.
   */
  async getModelResponse(prompt: string, model: Model = Model.UNSPECIFIED): Promise<string> {
      const req = new GetModelResponseRequest({
          prompt: prompt,
          model: model,
      });

      const response = await this.lsClient.getModelResponse(req);
      return response.response;
  }
}

export { T };


