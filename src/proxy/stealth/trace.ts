import { getSystemMode } from './prompt-modes.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ClientRequestSummary {
    message_count: number;
    tool_count: number;
    tool_round_count: number;
    user_text_len: number;
    user_text_preview: string;
    system_prompt: boolean;
    has_image: boolean;
}

export interface RequestBytes {
    original: number;
    modified: number;
}

export interface FunctionCallSummary {
    name: string;
    args_preview: string;
}

export interface ResponseSummary {
    text_len: number;
    thinking_len: number;
    text_preview?: string;
    finish_reason?: string;
    function_calls?: FunctionCallSummary[];
    grounding: boolean;
}

export interface TraceTurn {
    turn: number;
    mitm_matched: boolean;
    gate_wait_ms?: number;
    modify_summary?: string;
    request_bytes?: RequestBytes;
    upstream_wait_ms?: number;
    response?: ResponseSummary;
    events_sent?: string[];
    handler_action?: string;
}

export interface TrackedUsage {
    input_tokens: number;
    output_tokens: number;
    thinking_tokens: number;
    cache_read: number;
}

export interface TraceData {
    cascade_id: string;
    endpoint: string;
    prompt_mode?: string;
    model: string;
    stream: boolean;
    started_at: string;
    finished_at?: string;
    duration_ms: number;
    outcome: string;
    client_request?: ClientRequestSummary;
    turns: TraceTurn[];
    usage?: TrackedUsage;
    errors: string[];
}

export class TraceCollector {
    public startTrace() {}
    public writeTrace() {}
    private data: TraceData;
    private startTime: number;
    private enabled: boolean;

    constructor(
        endpoint: string,
        cascadeId: string,
        model: string,
        stream: boolean,
        clientRequest?: ClientRequestSummary
    ) {
        this.enabled = process.env.ANTIGRAVITY_TRACING !== 'false';
        this.startTime = Date.now();



        this.data = {
            prompt_mode: getSystemMode(),
            cascade_id: cascadeId,
            endpoint: endpoint,
            model: model,
            stream: stream,
            started_at: new Date(this.startTime).toISOString(),
            duration_ms: 0,
            outcome: 'pending',
            client_request: clientRequest,
            turns: [],
            errors: []
        };
    }

    public setCascadeId(id: string) {
        this.data.cascade_id = id;
    }

    public addTurn(turn: TraceTurn) {
        if (!this.enabled) return;
        this.data.turns.push(turn);
    }

    public addError(error: string) {
        if (!this.enabled) return;
        this.data.errors.push(error);
    }

    public setUsage(usage: TrackedUsage) {
        if (!this.enabled) return;
        this.data.usage = usage;
    }

    private sanitize() {
        // Redact any authorization tokens or PII that might have leaked into previews or summaries
        const redact = (str: string) => {
            if (!str) return str;
            return str.replace(/Bearer\s+[A-Za-z0-9\-\._~+\/]+=*/gi, 'Bearer [REDACTED]')
                      .replace(/ya29\.[A-Za-z0-9\-\._~+\/]+/gi, '[REDACTED_OAUTH_TOKEN]');
        };

        if (this.data.client_request?.user_text_preview) {
            this.data.client_request.user_text_preview = redact(this.data.client_request.user_text_preview);
        }

        for (const turn of this.data.turns) {
            if (turn.response?.text_preview) {
                turn.response.text_preview = redact(turn.response.text_preview);
            }
            if (turn.modify_summary) {
                turn.modify_summary = redact(turn.modify_summary);
            }
            if (turn.events_sent) {
                turn.events_sent = turn.events_sent.map(redact);
            }
        }

        this.data.errors = this.data.errors.map(redact);
    }

    public async finishAndWrite(outcome: string) {
        if (!this.enabled) return;

        const now = Date.now();
        this.data.finished_at = new Date(now).toISOString();
        this.data.duration_ms = now - this.startTime;
        this.data.outcome = outcome;

        this.sanitize();

        try {
            const dateStr = new Date(this.startTime).toISOString().split('T')[0]; // YYYY-MM-DD

            const timeDate = new Date(this.startTime);
            const hh = String(timeDate.getUTCHours()).padStart(2, '0');
            const mm = String(timeDate.getUTCMinutes()).padStart(2, '0');
            const ss = String(timeDate.getUTCSeconds()).padStart(2, '0');
            const timeStr = `${hh}-${mm}-${ss}`;

            const cascadeShort = this.data.cascade_id.substring(0, 8);

            const dir = path.join(os.homedir(), '.config', 'antigravity', 'traces', dateStr);
            const filename = `${timeStr}_${cascadeShort}.json`;
            const filepath = path.join(dir, filename);

            await fs.promises.mkdir(dir, { recursive: true });

            const json = JSON.stringify(this.data, null, 2);
            await fs.promises.writeFile(filepath, json, 'utf8');
        } catch (err) {
            // Fail gracefully
            console.error(`[Trace] Failed to write trace file:`, err);
        }
    }
}
