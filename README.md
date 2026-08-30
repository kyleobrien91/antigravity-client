<div align="center">

# Antigravity Client

**Unofficial TypeScript client & CLI for the [Antigravity](https://antigravity.dev) Language Server**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

*Communicate directly with the Language Server binary via ConnectRPC. No IDE required.*

[Japanese README here](README_ja.md)

</div>

---

## What is this?

A standalone TypeScript library for communicating directly with the **Antigravity Language Server (LS)** binary via its ConnectRPC (gRPC-Web) protocol. Built by reverse-engineering the IDE's frontend code and reconstructing the original Protobuf schemas.

Unlike the official SDK (which extends the IDE via the VS Code Extension API), this project talks to the LS process itself — giving you raw, unrestricted access to every RPC method, every Protobuf message, and every streaming endpoint.

> [!IMPORTANT]
> This is **not** a VS Code extension SDK. This is a low-level client library that communicates directly with the Language Server binary over ConnectRPC. It can operate without a running IDE.

---

## 🤖 A Powerful Infrastructure for AI Agents

Antigravity LS is not just a tool; it is a **robust foundation for building autonomous AI agents.** By using this SDK, you can leverage the Language Server as a managed backend for your custom agents.

- **Managed Context & Sessions**: The LS server handles the complex heavy lifting of session management and context window optimization. This allows you to focus on high-layer development and agent logic rather than low-level state handling.
- **Advanced Prompt Tuning**: Inject custom prompts and metadata at a per-message level. This granular control allows for precise adjustment of agent behavior in specific scenarios.
- **Integrated Tooling & Search**: Seamlessly integrate web search, file indexing, and terminal execution. You can build custom agents that utilize these tools with surgical precision through a single SDK interface.
- **Event-Driven Architecture**: The SDK features a modern, event-driven `Cascade` API, cleanly separating stream management, state parsing, and API interaction, making it highly extensible and easy to reason about.

By offloading context management to the LS, you can spend your time engineering the "brain" of your agent rather than its infrastructure.

---

## Quick Start

```bash
npm install github:jkfujinami/antigravity-client
```

```typescript
import { AntigravityClient } from "antigravity-client";

const client = await AntigravityClient.connect();
const status = await client.getUserStatus();
console.log(`Connected as: ${status.userStatus?.name}`);
```

---

## 🌐 OpenAI-Compatible API Proxy Server

`antigravity-client` includes a high-performance, multi-protocol local proxy server that exposes Antigravity AI models through **standard OpenAI, Anthropic, and Gemini REST endpoints**.

Use any OpenAI-compatible tool, library, IDE extension, or CLI (such as Cursor, Cline, Roo Code, Aider, OpenCode, LibreChat, or the official OpenAI Python/Node SDKs) by pointing `baseURL` to `http://localhost:8741/v1`.

### 1. Extract Your Antigravity Token

Log in to the official Antigravity IDE / Desktop app once, then extract your credentials:

```bash
# Using npx:
npx ag extract

# Or from local clone:
npm run ag -- extract
```
*This extracts your OAuth refresh token and stores it safely in `~/.antigravity/accounts.json`.*

### 2. Start the Proxy Server

```bash
# Start proxy on default port 8741:
npx ag serve

# Or specify a custom port:
npx ag serve --port 9000

# Or from local clone:
npm run serve
```

When started, the proxy automatically:
1. Performs an authentic webview startup warmup sequence.
2. Initializes stealth device fingerprinting and anti-detection telemetry.
3. Launches background quota monitors and heartbeat jitter loops.
4. Serves OpenAI, Anthropic, and Gemini endpoints on `http://localhost:8741`.

---

### 3. Usage Examples

#### cURL (OpenAI Chat Completions)

```bash
curl http://localhost:8741/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{
    "model": "gemini-3-flash",
    "messages": [
      {"role": "system", "content": "You are a helpful coding assistant."},
      {"role": "user", "content": "Write a TypeScript function to reverse a string."}
    ],
    "stream": false
  }'
```

#### Streaming SSE (Server-Sent Events)

```bash
curl -N http://localhost:8741/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-key" \
  -d '{
    "model": "gemini-3.1-pro",
    "messages": [{"role": "user", "content": "Explain quantum computing in 3 sentences."}],
    "stream": true
  }'
```

#### Python (`openai` SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8741/v1",
    api_key="dummy-key"  # Any non-empty string
)

response = client.chat.completions.create(
    model="gemini-3-flash",  # Or "gpt-4o", "claude-3-5-sonnet", "gemini-3.1-pro"
    messages=[
        {"role": "system", "content": "You are an expert Python engineer."},
        {"role": "user", "content": "How do Python generators work under the hood?"}
    ],
    stream=True
)

for chunk in response:
    content = chunk.choices[0].delta.content or ""
    print(content, end="", flush=True)
```

#### TypeScript / Node.js (`openai` SDK)

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
    baseURL: "http://localhost:8741/v1",
    apiKey: "dummy-key",
});

const completion = await openai.chat.completions.create({
    model: "gpt-4o", // Automatically aliased to gemini-3-flash
    messages: [{ role: "user", content: "Write a hello world in Rust" }],
    stream: true,
});

for await (const chunk of completion) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

---

### Supported Endpoints

| Protocol | Endpoint | Description |
|---|---|---|
| **OpenAI** | `GET /v1/models` | List all available models & aliases |
| **OpenAI** | `POST /v1/chat/completions` | Chat completions (streaming & non-streaming) |
| **OpenAI** | `POST /v1/responses` | OpenAI Responses API streaming SSE endpoint |
| **Anthropic** | `POST /v1/messages` | Claude Messages API compatible format |
| **Gemini** | `POST /v1beta/models/*` | Native Google AI Studio / Gemini REST API |
| **Quota** | `GET /v1/quota`, `GET /v1/credits` | Current Antigravity quota and credit balances |
| **Health** | `GET /health` | Healthcheck endpoint (`{"status": "ok"}`) |

---

### Model Aliases & Compatibility

The proxy provides built-in model aliases so existing client tools work seamlessly without changing configurations:

| Client Model Name | Mapped Target Model |
|---|---|
| `gpt-4o` | `gemini-3-flash` |
| `gpt-4` | `gemini-3.1-pro` |
| `claude-3-5-sonnet` | `gemini-3-flash` |
| `sonnet-4.6` | `gemini-3-flash` |
| `opus-4.6` | `gemini-3.1-pro` |
| Native Antigravity Models | `gemini-3-flash`, `gemini-3.1-pro`, etc. |

#### Custom Model Aliases
You can define custom model aliases via environment variable or in `~/.antigravity/aliases.json`:

```bash
export ANTIGRAVITY_MODEL_ALIASES="my-custom-model:gemini-3.1-pro,gpt-4o-mini:gemini-3-flash"
```

---

### Connecting with AI Coding Extensions & Tools

| Tool | Configuration Summary |
|---|---|
| **OpenCode** | Provider: `@ai-sdk/openai-compatible`<br>Base URL: `http://localhost:8741/v1`<br>API Key: `dummy-key`<br>Config: `opencode.json` |
| **Hermes Agent** | Provider: `custom`<br>Base URL: `http://localhost:8741/v1`<br>API Key: `dummy-key`<br>Command: `hermes model` or `~/.hermes/config.yaml` |
| **Cline / Roo Code** | Provider: `OpenAI Compatible`<br>Base URL: `http://localhost:8741/v1`<br>API Key: `dummy-key`<br>Model ID: `gemini-3-flash` or `gemini-3.1-pro` |
| **Cursor** | Custom OpenAI API Base URL: `http://localhost:8741/v1`<br>OpenAI API Key: `dummy-key` |
| **Aider** | `aider --openai-api-base http://localhost:8741/v1 --openai-api-key dummy-key --model gemini-3.1-pro` |
| **LibreChat** | Set `OPENAI_REVERSE_PROXY=http://localhost:8741/v1` in `.env` |
| **Continue.dev** | Add provider `openai` with `"apiBase": "http://localhost:8741/v1"` in `config.json` |

---

#### 💻 Configuring OpenCode

OpenCode uses the `@ai-sdk/openai-compatible` adapter. You can configure it either at project level (`opencode.json`) or globally (`~/.config/opencode/opencode.json` or `~/.opencode.json`):

1. **Create or edit `opencode.json`**:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "antigravity": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Antigravity Proxy",
      "options": {
        "baseURL": "http://localhost:8741/v1"
      },
      "models": {
        "gemini-3-flash": {
          "name": "Gemini 3 Flash"
        },
        "gemini-3.1-pro": {
          "name": "Gemini 3.1 Pro"
        },
        "claude-3-5-sonnet": {
          "name": "Claude 3.5 Sonnet (Antigravity)"
        }
      }
    }
  }
}
```

2. **Authenticate with OpenCode**:
Run the interactive auth command and enter the provider ID (`antigravity`) with any placeholder key:
```bash
opencode auth login
# Select "Other" -> Enter Provider ID: "antigravity" -> API Key: "dummy-key"
```
*Or set the environment variable: `export ANTIGRAVITY_API_KEY=dummy-key`.*

3. **Launch OpenCode**:
```bash
opencode
# Use /models in the TUI to select gemini-3-flash or gemini-3.1-pro
```

---

#### 🧠 Configuring Hermes (Nous Research)

Hermes Agent connects to custom OpenAI-compatible endpoints via the interactive CLI wizard or `~/.hermes/config.yaml`.

##### Option A: Interactive CLI Wizard (Recommended)
```bash
hermes model
```
1. Select **Custom endpoint** from the provider list.
2. Enter **Base URL**: `http://localhost:8741/v1`
3. Enter **API Key**: `dummy-key`
4. Enter **Model**: `gemini-3-flash` (or `gemini-3.1-pro`)

##### Option B: Direct CLI Commands
```bash
hermes config set model.provider custom
hermes config set model.base_url http://localhost:8741/v1
hermes config set model.default gemini-3-flash
```

##### Option C: Manual `~/.hermes/config.yaml`
```yaml
model:
  provider: custom
  default: gemini-3-flash
  base_url: http://localhost:8741/v1
```
And add to `~/.hermes/.env`:
```bash
CUSTOM_API_KEY=dummy-key
```

Verify your setup with:
```bash
hermes doctor
```

---

---

### ⚡ CLI Reference (`ag`)

```bash
ag <command> [options]
```

| Command | Description |
|---|---|
| `ag extract` | Extract OAuth credentials from local Antigravity IDE into `~/.antigravity/accounts.json` |
| `ag serve [--port 8741]` | Start the multi-protocol OpenAI / Anthropic / Gemini proxy server |
| `ag acp` | Run the Agent Client Protocol (ACP) JSON-RPC STDIO server (for Zed, Neovim, etc.) |
| `ag quota` | Query live quota tiers, model rate limits, and remaining credits |
| `ag fingerprint` | Display current stealth device fingerprint and IDE telemetry headers |

---

## Features

### Direct Language Server Communication

The SDK exposes a type-safe `LanguageServerFacade` wrapping **all 188 RPC methods** from the LS service definition. Every method accepts and returns fully-typed Protobuf messages — no string keys, no `any`.

```typescript
const client = await AntigravityClient.connect();

// Call any of the 188 RPC methods directly
const response = await client.languageServer.acceptTermsOfService({ metadata });
const models   = await client.languageServer.getCascadeModelConfigs({ metadata });
const status   = await client.languageServer.getMcpServerStates({});

// Or use the convenience wrapper
const userStatus = await client.getUserStatus();
```

> [!NOTE]
> The facade layer (`src/facade/`) is auto-generated from the reconstructed Protobuf schemas. Each method accepts a plain object matching the request message shape and returns the fully-typed response.

### Event-Driven Cascade API

The `Cascade` class manages real-time streaming from the AI agent. It internally splits the work into two modules: `CascadeStreamHandler` (gRPC stream lifecycle) and `CascadeEventParser` (state diffing and event emission), exposing **130 typed events** — from high-level (`text`, `thinking`, `statusChange`) to granular per-step events (`step:runCommand`, `step:writeToFile`, `step:browserSubagent`, etc.).

```typescript
const cascade = await client.startCascade();

// High-level events
cascade.on(Cascade.Events.Text, (ev) => process.stdout.write(ev.delta));
cascade.on(Cascade.Events.Thinking, (ev) => process.stdout.write(ev.delta));
cascade.on(Cascade.Events.StatusChange, (ev) => {
    console.log(`${ev.previousStatus} → ${ev.status}`);
});

// Granular per-step events (one for each of the ~120 step types)
cascade.on(Cascade.Events.RunCommand, (ev) => {
    console.log(`Command: ${ev.step.value.proposedCommandLine}`);
});
cascade.on(Cascade.Events.WriteToFile, (ev) => {
    console.log(`File: ${ev.step.value.filePath}`);
});

// Interaction approval (commands, file edits, browser actions)
cascade.on(Cascade.Events.Interaction, async (req) => {
    if (req.type === "run_command") {
        await req.approve();
    }
});
```

### High-Level Convenience Methods

For simple use cases, skip the event wiring entirely.

```typescript
// One-shot: send a prompt, wait for completion, get results
const result = await cascade.run("Fix all TypeScript errors in this project", {
    model: "Gemini_3_Flash",
    timeoutMs: 120_000,
});

console.log(result.text);        // Full response text
console.log(result.newSteps);    // CascadeStep[] added this turn
console.log(result.finalStatus); // "idle" | "running" | ...
console.log(result.timedOut);    // boolean

// Other high-level helpers
await cascade.waitForIdle();
await cascade.waitForTurnComplete();
await cascade.cancelAndWait();
```

### Approval Control

Programmatically approve or reject agent actions — terminal commands, file edits, browser navigation.

```typescript
// Terminal command approval
await cascade.approveCommand(stepIndex, "npm install");
await cascade.denyCommand(stepIndex, "rm -rf /");

// File permission
await cascade.approveFilePermission(stepIndex, "/path/to/file", PermissionScope.ONCE);
await cascade.denyFilePermission(stepIndex, "/path/to/file");

// Browser URL
await cascade.approveOpenBrowserUrl(stepIndex);
await cascade.denyOpenBrowserUrl(stepIndex);

// Generic interaction
await cascade.sendInteraction(stepIndex, "permission", { allow: true, scope: 1 });
```

### Model Selection

Query available models and select per-message.

```typescript
// List available models
const models = await client.getAvailableModels();
// => { Gemini_3_Flash: { modelId: 42, isRecommended: true, ... }, ... }

// Send with explicit model
await cascade.sendMessage("Explain this code", {
    model: "Gemini_3_Flash",     // By name
    // model: 42,                // Or by numeric ID
});

// Attach images
await cascade.sendMessage("What's in this screenshot?", {
    images: [{
        base64Data: "iVBOR...",
        mimeType: "image/png",
        caption: "Error screenshot",
    }],
});
```

### Standalone Mode (No IDE)

Launch an independent Language Server process without a running Antigravity IDE. The SDK starts a Mock Extension Server to supply OAuth tokens via the USS protocol.

```typescript
const client = await AntigravityClient.launch({
    workspacePath: "/path/to/project",
    verbose: true,
    cdpPort: 9222,  // Optional: Chrome DevTools Protocol port
});

// Use normally
const cascade = await client.startCascade();
const result = await cascade.run("Analyze this codebase");

// Clean up
client.dispose();
client.launcher.stop();
```

### Session Management

Resume, list, and manage cascade conversations.

```typescript
// Resume an existing cascade by ID (verifies it's alive)
const cascade = await client.resumeCascade("76a484e0-...");

// Attach to a cascade without verification
const cascade2 = client.getCascade("76a484e0-...");

// Fetch full trajectory history
const history = await cascade.getHistory();

// Cancel in-flight work
await cascade.cancel();

// Stream cascade summaries (list of all conversations)
for await (const update of client.getSummariesStream()) {
    console.log(update);
}
```

### Quick Model Response

Get a one-shot AI response without creating a full cascade session.

```typescript
const response = await client.getModelResponse(
    "What is the capital of France?",
    Model.GEMINI_3_FLASH
);
console.log(response); // "Paris"
```

---

## Connection Methods

| Method | Description | IDE Required |
|--------|-------------|:---:|
| `AntigravityClient.connect()` | Auto-detect running LS process | Yes |
| `AntigravityClient.connect({ port, csrfToken })` | Manual connection to known LS | Yes |
| `AntigravityClient.connectWithServer(serverInfo)` | Connect via `ServerInfo` object | Yes |
| `AntigravityClient.launch(options)` | Start independent LS + Mock Extension Server | **No** |
| `AntigravityClient.listServers()` | Discover all running LS processes | Yes |

---

## Web UI (Browser)

Run the **stock Antigravity IDE web UI in a plain browser** — no Electron, no IDE install required. `npm run web` launches a standalone Language Server and serves its *unmodified* frontend through a reverse proxy that speaks HTTP/2 to the browser and injects a web port of Electron's `preload.js`, so the original bundle runs untouched.

```bash
# Installed as a dependency — run via npx:
npx antigravity-web
# …or install globally for a bare `antigravity-web` command:
npm install -g github:jkfujinami/antigravity-client

# From a checkout of this repo:
npm run web

# → then open https://localhost:8765/  (accept the self-signed cert warning once)
```

By default it points at your real `~/.gemini` profile with `appDataDir: "antigravity"` (the IDE's namespace), so your existing **Projects and conversations show up** in the browser. **Close the Antigravity IDE first** — two Language Servers writing the same state can corrupt it. Use an isolated profile to run alongside the IDE safely.

```bash
# Positional args:  [workspacePath] [geminiDir] [appDataDir]
npm run web -- /path/to/project

# Isolated profile (safe to run while the IDE is open)
npm run web -- /path/to/project /tmp/gemini_iso antigravity_client

# The antigravity-web bin takes the same positional args directly (no `--`)
antigravity-web /path/to/project /tmp/gemini_iso antigravity_client

# Env vars work with either form
PORT=9000 GEMINI_DIR=~/.gemini APP_DATA_DIR=antigravity npx antigravity-web
```

| Option | Positional | Env | Default |
|--------|-----------|-----|---------|
| Workspace path | `argv[2]` | — | `cwd()` |
| Gemini profile dir | `argv[3]` | `GEMINI_DIR` | `~/.gemini` |
| App-data namespace | `argv[4]` | `APP_DATA_DIR` | `antigravity` |
| Listen port | — | `PORT` | `8765` |
| Verbose logging | — | `VERBOSE` | off |

> **Why HTTP/2?** The UI opens many long-lived server-streams at once (notably one `WatchDirectory` per open file). Over HTTP/1.1 a browser caps at ~6 connections per origin, starving the extra streams so the file view spins forever. HTTP/2 multiplexes them all over a single connection — exactly what the native app does — which is why the proxy serves the browser over TLS h2.

---

## Architecture

```
Your App / CLI / Agent
        │
        ▼
┌──────────────────────────────────────────────────────┐
│                 antigravity-client                    │
│                                                      │
│  AntigravityClient          ← Connection & lifecycle │
│    .languageServer          ← 188 RPC methods        │
│    .startCascade()          ← Event-driven sessions  │
│    .resumeCascade()         ← Session recovery       │
│    .getModelResponse()      ← One-shot inference     │
│                                                      │
│  Cascade                    ← EventEmitter           │
│    ├─ CascadeStreamHandler  ← gRPC stream lifecycle  │
│    └─ CascadeEventParser    ← State diff → 130 events│
│                                                      │
│  LanguageServerFacade       ← Auto-generated facade  │
│    (188 type-safe methods)                           │
│                                                      │
│  Launcher + MockExtServer   ← Standalone mode        │
│  AutoDetector               ← LS process discovery   │
│  AuthReader                 ← OAuth from state.vscdb │
└──────────────────────────────────────────────────────┘
        │
        ▼ ConnectRPC (HTTP/2 + TLS)
┌──────────────────────────────────────────────────────┐
│           Language Server (Go binary)                │
│           127.0.0.1:<port>                           │
└──────────────────────────────────────────────────────┘
        │
        ▼ HTTPS
┌──────────────────────────────────────────────────────┐
│               Google AI Backend                      │
└──────────────────────────────────────────────────────┘
```

### Source Layout

```
src/
├── index.ts                  # Public API exports
├── core/
│   ├── client.ts             # AntigravityClient (connect, launch, model resolution)
│   └── cascade/
│       ├── index.ts           # Cascade class (EventEmitter + API methods)
│       ├── stream-handler.ts  # gRPC stream loop & state hydration
│       └── event-parser.ts    # State diff calculation & event emission
├── facade/
│   ├── index.ts               # Type namespace (T.LanguageServer.*)
│   ├── services.ts            # LanguageServerFacade (188 auto-generated methods)
│   └── inputs.ts              # Input type definitions
├── types/
│   ├── index.ts               # CascadeStep, helper types, enums
│   └── events.ts              # 130 event constants & payload types
├── server/
│   ├── launcher.ts            # Standalone LS process management
│   ├── mock-extension-server.ts # USS OAuth token provider
│   └── auth-reader.ts         # SQLite credential reader
├── utils/
│   └── autodetect.ts          # LS process discovery (ps, lsof)
├── reactive/
│   └── apply.ts               # Protobuf diff application
└── gen/                       # Generated Protobuf bindings
    └── exa/
        ├── language_server_pb/  # LS service & message definitions
        ├── cortex_pb/           # Cascade state, step types, interactions
        ├── codeium_common_pb/   # Shared types (Metadata, Model, etc.)
        └── ...
```

---

## How It Works

All communication happens through three local channels:

1. **ConnectRPC over TLS** — The SDK connects to the LS binary on `127.0.0.1` via HTTP/2 with a per-session CSRF token. This is the same protocol the IDE uses internally.
2. **Read-only SQLite** — For standalone mode, the SDK reads `state.vscdb` via `better-sqlite3` to extract OAuth tokens. No writes, no external `sqlite3` CLI dependency.
3. **Process inspection** — Auto-detection uses `ps`/`lsof` (macOS/Linux) or PowerShell `Get-CimInstance`/`Get-NetTCPConnection` (Windows) to find running LS processes and their ports.

No data leaves the local machine through the SDK. The LS binary itself communicates with Google's backend, but the SDK only talks to the LS.

---

## Platform Support

| Platform | IDE Connection | Standalone Mode |
|----------|:-:|:-:|
| **macOS** (arm64/x64) | ✅ | ✅ |
| **Linux** (x64) | ✅ | ✅ |
| **Windows** (x64) | ✅ | ✅ |

> Linux support contributed by [@Masterisk-F](https://github.com/Masterisk-F) ([#7](https://github.com/jkfujinami/antigravity-client/pull/7)).
>
> Windows support contributed by [@Yusuke-forcode](https://github.com/Yusuke-forcode) ([#9](https://github.com/jkfujinami/antigravity-client/pull/9)).
>
> **Windows note:** The Web UI requires `openssl` for self-signed cert generation. If Git for Windows is installed, its bundled openssl is auto-detected. Otherwise install via `choco install openssl` or `winget install ShiningLight.OpenSSL`. You can also supply your own certificates via `TLS_CERT` / `TLS_KEY` environment variables (e.g., Tailscale HTTPS certs or mkcert).
>
> **Windows note (auto-detection):** When *attaching* to an already-running LS, the HTTPS port is inferred from the lowest listening port. On macOS/Linux this is robust (ports are matched by file-descriptor open order); Windows exposes no FD order, so the lowest port number is used as a best-effort proxy. It can occasionally mis-identify the port if Windows allocated the ephemeral ports non-sequentially or wrapped around the dynamic range (49152–65535). Standalone (launched) mode is unaffected — the port is read directly from the LS startup log.

---

## Protobuf Schemas

The reconstructed `.proto` schemas used by this project are maintained in a separate repository:

**[jkfujinami/antigravity-grpc-schemas](https://github.com/jkfujinami/antigravity-grpc-schemas)**

These schemas were extracted from the Antigravity IDE's frontend bundle and cover the full LS service definition, including Cascade state management, MCP server control, reactive update streams, and more.

---

## Tooling: Mock Generator

When working with complex RPC methods (like `startCascade` or `startBattleMode`), building the exact TypeScript object literal to satisfy the generated ConnectRPC `PartialMessage` type can be tricky. This is especially true for `oneof` fields which require a specific `{ case: "...", value: ... }` structure.

To prevent type errors, this project includes a high-fidelity mock generator that dumps perfectly typed boilerplate:

```bash
# Dump the exact structure required for a method
npx tsx scripts/mock_gen.ts startCascade

# Or extract a specific nested path (jq-style)
npx tsx scripts/mock_gen.ts startCascade customAgentSpec.workspace
```
---

## Examples

| File | Description |
|------|-------------|
| [`full_workflow.ts`](examples/full_workflow.ts) | Complete event listener with colored terminal output |
| [`test_cascade_events.ts`](examples/test_cascade_events.ts) | Comprehensive event assertion test |
| [`test_chat.ts`](examples/test_chat.ts) | Simple send-and-receive |
| [`test_independent_ls.ts`](examples/test_independent_ls.ts) | Standalone mode (no IDE) |
| [`test_resume.ts`](examples/test_resume.ts) | Resume an existing cascade |
| [`test_shell_exec.ts`](examples/test_shell_exec.ts) | Terminal command execution & approval |
| [`test_universal.ts`](examples/test_universal.ts) | Cross-platform connection test |
| [`test_custom_agents.ts`](examples/test_custom_agents.ts) | Custom agent configuration |

Run any example with:

```bash
npx tsx examples/full_workflow.ts
```

---

## Disclaimer

> [!WARNING]
> This project is not affiliated with Google or the Antigravity team. It interacts with the Language Server through reverse-engineered Protobuf schemas. Use at your own risk and in compliance with applicable terms of service.

---

## Contributing

PRs welcome. If you encounter a schema mismatch after an Antigravity update, open an issue with the error message and your LS version.

1. Fork the repo
2. Create a feature branch
3. Follow existing code style
4. Run `tsc --noEmit` and `npx tsx examples/test_cascade_events.ts` before submitting

---

## License

[MIT](LICENSE)
