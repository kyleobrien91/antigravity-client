import * as jsonrpc from 'vscode-jsonrpc/node.js';
import { AccountsStore } from '../../accounts/store.js';
import { AntigravityClient } from '../../core/client.js';
import { CascadeEvents } from '../../types/events.js';

export async function runAcp() {
    // Redirect console logs to stderr so they don't break JSON-RPC stdout
    const originalConsoleLog = console.log;
    const originalConsoleInfo = console.info;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
    console.info = (...args) => process.stderr.write(args.join(' ') + '\n');
    console.warn = (...args) => process.stderr.write(args.join(' ') + '\n');
    console.error = (...args) => process.stderr.write(args.join(' ') + '\n');

    // Create the JSON-RPC connection over stdin/stdout
    const connection = jsonrpc.createMessageConnection(
        new jsonrpc.StreamMessageReader(process.stdin),
        new jsonrpc.StreamMessageWriter(process.stdout)
    );

    let activeClient: AntigravityClient | null = null;
    let activeCascade: any = null;

    connection.onRequest('initialize', async (params) => {
        return {
            protocolVersion: '2.0',
            agentInfo: {
                name: 'Antigravity Agent Protocol Server',
                version: '1.0.0'
            },
            capabilities: {
                auth: true,
                session: true
            }
        };
    });

    connection.onRequest('auth/login', async () => {
        try {
            const store = new AccountsStore();
            const config = store.load();
            return {
                authenticated: config.active !== undefined && config.accounts.length > 0,
                activeAccount: config.active,
            };
        } catch (err: any) {
            return { authenticated: false, error: err.message };
        }
    });

    connection.onRequest('session/new', async () => {
        try {
            activeClient = await AntigravityClient.connect();
            activeCascade = await activeClient.startCascade();
            return {
                sessionId: activeCascade.cascadeId
            };
        } catch (err: any) {
            throw new jsonrpc.ResponseError(jsonrpc.ErrorCodes.InternalError, err.message);
        }
    });

    connection.onRequest('session/prompt', async (params: any) => {
        if (!activeCascade) {
            throw new jsonrpc.ResponseError(jsonrpc.ErrorCodes.InvalidRequest, "No active session. Call session/new first.");
        }

        const promptText = params.prompt;
        if (!promptText) {
            throw new jsonrpc.ResponseError(jsonrpc.ErrorCodes.InvalidParams, "prompt parameter is required.");
        }

        try {
            const resultPromise = new Promise((resolve, reject) => {
                let fullResponse = "";
                let hasError = false;

                const textListener = (evt: any) => {
                    fullResponse = evt.fullText;
                    connection.sendNotification('session/update', {
                        sessionId: activeCascade.cascadeId,
                        type: 'text_delta',
                        delta: evt.delta
                    });
                };

                const thinkingListener = (evt: any) => {
                    connection.sendNotification('session/update', {
                        sessionId: activeCascade.cascadeId,
                        type: 'thinking_delta',
                        delta: evt.delta
                    });
                };

                const interactionListener = async (evt: any) => {
                     // Auto-approve simple file read interactions for ACP if they're auto-approvable
                     if (evt.needsApproval) {
                         if (evt.type === 'file_permission') {
                             await evt.approve();
                         }
                     }
                };

                const doneListener = () => {
                     cleanup();
                     resolve({ response: fullResponse });
                };

                const errorListener = (err: any) => {
                     cleanup();
                     if (!hasError) {
                         hasError = true;
                         reject(err);
                     }
                };

                const cleanup = () => {
                    activeCascade.off(CascadeEvents.Text, textListener);
                    activeCascade.off(CascadeEvents.Thinking, thinkingListener);
                    activeCascade.off(CascadeEvents.Interaction, interactionListener);
                    activeCascade.off(CascadeEvents.Done, doneListener);
                    activeCascade.off(CascadeEvents.Error, errorListener);
                };

                activeCascade.on(CascadeEvents.Text, textListener);
                activeCascade.on(CascadeEvents.Thinking, thinkingListener);
                activeCascade.on(CascadeEvents.Interaction, interactionListener);
                activeCascade.on(CascadeEvents.Done, doneListener);
                activeCascade.on(CascadeEvents.Error, errorListener);

                // Fire off the prompt
                activeCascade.sendMessage({ text: promptText }).catch(errorListener);
            });

            return await resultPromise;
        } catch (err: any) {
             throw new jsonrpc.ResponseError(jsonrpc.ErrorCodes.InternalError, err.message);
        }
    });

    connection.onRequest('session/cancel', async () => {
        if (!activeCascade) {
            throw new jsonrpc.ResponseError(jsonrpc.ErrorCodes.InvalidRequest, "No active session.");
        }
        try {
            await activeCascade.cancel();
            return { status: 'cancelled' };
        } catch (err: any) {
             throw new jsonrpc.ResponseError(jsonrpc.ErrorCodes.InternalError, err.message);
        }
    });

    connection.listen();
}
