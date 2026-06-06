var _SessionToolRunner_instances, _SessionToolRunner_consumed, _SessionToolRunner_controller, _SessionToolRunner_detachExternal, _SessionToolRunner_requestOpts, _SessionToolRunner_toolByName, _SessionToolRunner_logger, _SessionToolRunner_seen, _SessionToolRunner_answered, _SessionToolRunner_results, _SessionToolRunner_inFlightCount, _SessionToolRunner_onIdle, _SessionToolRunner_idleTimer, _SessionToolRunner_requestOptions, _SessionToolRunner_streamLoop, _SessionToolRunner_reconcile, _SessionToolRunner_ingestHistory, _SessionToolRunner_handleStreamEvent, _SessionToolRunner_armIdleTimer, _SessionToolRunner_disarmIdleTimer, _SessionToolRunner_execute, _SessionToolRunner_sendResult, _SessionToolRunner_drain;
import { __classPrivateFieldGet, __classPrivateFieldSet } from "../../internal/tslib.mjs";
import { AnthropicError } from "../../core/error.mjs";
import { loggerFor } from "../../internal/utils/log.mjs";
import { sleep } from "../../internal/utils/sleep.mjs";
import { isFatal4xx } from "../../internal/utils/backoff.mjs";
import { linkAbort } from "../../internal/utils/abort.mjs";
import { AsyncQueue } from "../../internal/utils/async-queue.mjs";
import { buildHeaders } from "../../internal/headers.mjs";
import { runRunnableTool, toolName } from "./BetaRunnableTool.mjs";
/** Beta header for the managed-agents API. */
export const MANAGED_AGENTS_BETA = 'managed-agents-2026-04-01';
/** `x-stainless-helper` value identifying this helper in SDK telemetry. */
const HELPER_NAME = 'SessionToolRunner';
const STREAM_BACKOFF_START_MS = 500;
const STREAM_BACKOFF_CAP_MS = 10000;
const TOOL_TIMEOUT_MS = 120000;
const DRAIN_TIMEOUT_MS = 30000;
const SEND_RETRIES = 3;
/** Default {@link SessionToolRunnerOptions.maxIdleMs}: 60 seconds. */
export const DEFAULT_MAX_IDLE_MS = 60000;
/** Returns true if `ev` is a `session.status_idle` with `stop_reason` `end_turn`. */
function isEndTurnIdle(ev) {
    return ev.type === 'session.status_idle' && ev.stop_reason?.type === 'end_turn';
}
/**
 * The sessions-side counterpart to `client.beta.messages.toolRunner`: an
 * async-iterable that attaches to a managed-agents session, executes every
 * incoming `agent.tool_use` and `agent.custom_tool_use` event against a local
 * tool registry, posts the matching result back (`user.tool_result` for the
 * former, `user.custom_tool_result` for the latter), and yields one
 * {@link DispatchedToolCall} per completed call. Server-side `agent.mcp_tool_use`
 * calls are not dispatched. Internally drives event-stream reconnect and result
 * posting.
 *
 * Iteration ends when the session terminates (`session.status_terminated` /
 * `session.deleted`), when the consumer `break`s out of the loop or aborts the
 * supplied signal, or — once the session has gone idle with
 * `stop_reason.type === "end_turn"` — when `maxIdleMs` elapses with no new
 * event (any new event resets that countdown; it re-arms on the next `end_turn`
 * idle; `maxIdleMs <= 0` disables it). The `finally` branch drains any in-flight
 * tool calls and runs each tool's `close()` cleanup hook. It does *not* touch
 * the work-item lease — wrap it in an `EnvironmentWorker` if you need
 * heartbeating / force-stop.
 *
 * @example
 * ```ts
 * import { betaAgentToolset20260401 } from '@anthropic-ai/sdk/tools/agent-toolset/node';
 *
 * for await (const call of client.beta.sessions.events.toolRunner(work.data.id, {
 *   tools: [...betaAgentToolset20260401({ workdir }), myTool],
 * })) {
 *   console.log(`${call.name} -> ${call.isError ? 'error' : 'ok'}`);
 * }
 * ```
 */
export class SessionToolRunner {
    constructor(sessionId, opts) {
        _SessionToolRunner_instances.add(this);
        _SessionToolRunner_consumed.set(this, false);
        _SessionToolRunner_controller.set(this, void 0);
        _SessionToolRunner_detachExternal.set(this, void 0);
        _SessionToolRunner_requestOpts.set(this, void 0);
        _SessionToolRunner_toolByName.set(this, void 0);
        _SessionToolRunner_logger.set(this, void 0);
        _SessionToolRunner_seen.set(this, new Set());
        _SessionToolRunner_answered.set(this, new Set());
        _SessionToolRunner_results.set(this, new AsyncQueue());
        _SessionToolRunner_inFlightCount.set(this, 0);
        _SessionToolRunner_onIdle.set(this, null);
        // When the session is idle past an `end_turn`, the pending stop timer; cleared
        // by any new event. Event-driven — there is no polling watchdog.
        _SessionToolRunner_idleTimer.set(this, void 0);
        this.client = opts.client;
        this.sessionId = sessionId;
        this.tools = opts.tools;
        this.maxIdleMs = opts.maxIdleMs ?? DEFAULT_MAX_IDLE_MS;
        __classPrivateFieldSet(this, _SessionToolRunner_logger, loggerFor(opts.client), "f");
        __classPrivateFieldSet(this, _SessionToolRunner_toolByName, new Map(opts.tools.map((t) => [toolName(t), t])), "f");
        __classPrivateFieldSet(this, _SessionToolRunner_controller, new AbortController(), "f");
        __classPrivateFieldSet(this, _SessionToolRunner_detachExternal, linkAbort(opts.signal, __classPrivateFieldGet(this, _SessionToolRunner_controller, "f")), "f");
        __classPrivateFieldSet(this, _SessionToolRunner_requestOpts, opts.requestOptions, "f");
    }
    /** Read-only view of this runner's abort signal. */
    get signal() {
        return __classPrivateFieldGet(this, _SessionToolRunner_controller, "f").signal;
    }
    /** Abort the runner. Background tasks will wind down and `for await` will exit cleanly. */
    abort() {
        __classPrivateFieldGet(this, _SessionToolRunner_controller, "f").abort();
    }
    async *[(_SessionToolRunner_consumed = new WeakMap(), _SessionToolRunner_controller = new WeakMap(), _SessionToolRunner_detachExternal = new WeakMap(), _SessionToolRunner_requestOpts = new WeakMap(), _SessionToolRunner_toolByName = new WeakMap(), _SessionToolRunner_logger = new WeakMap(), _SessionToolRunner_seen = new WeakMap(), _SessionToolRunner_answered = new WeakMap(), _SessionToolRunner_results = new WeakMap(), _SessionToolRunner_inFlightCount = new WeakMap(), _SessionToolRunner_onIdle = new WeakMap(), _SessionToolRunner_idleTimer = new WeakMap(), _SessionToolRunner_instances = new WeakSet(), Symbol.asyncIterator)]() {
        if (__classPrivateFieldGet(this, _SessionToolRunner_consumed, "f")) {
            throw new AnthropicError('Cannot iterate over a consumed SessionToolRunner');
        }
        __classPrivateFieldSet(this, _SessionToolRunner_consumed, true, "f");
        __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").info('session tool runner starting', {
            component: 'session-tool-runner',
            session_id: this.sessionId,
        });
        // The one background promise: drives the event stream and dispatches tools.
        // Its `.catch` aborts the controller so the main loop unwinds.
        const streamPromise = __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_streamLoop).call(this).catch((e) => {
            if (!__classPrivateFieldGet(this, _SessionToolRunner_controller, "f").signal.aborted) {
                __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").error('stream loop failed', { error: String(e) });
            }
            __classPrivateFieldGet(this, _SessionToolRunner_controller, "f").abort();
        });
        try {
            // Phase 1: yield results as they arrive. `next(signal)` resolves
            // `done: true` when the controller aborts — cancellation is handled in
            // the queue read, no outer `Promise.race` needed.
            while (true) {
                const next = await __classPrivateFieldGet(this, _SessionToolRunner_results, "f").next(__classPrivateFieldGet(this, _SessionToolRunner_controller, "f").signal);
                if (next.done)
                    break;
                yield next.value;
            }
            // Phase 2: let the stream loop settle (and push any final results), then
            // drain whatever is still queued before closing.
            await streamPromise;
            let pending;
            while ((pending = __classPrivateFieldGet(this, _SessionToolRunner_results, "f").tryShift()) !== undefined) {
                yield pending;
            }
        }
        finally {
            __classPrivateFieldGet(this, _SessionToolRunner_controller, "f").abort();
            __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_disarmIdleTimer).call(this);
            // Re-await defensively in case the consumer broke out of phase 1 before
            // phase 2 ran — a no-op if it already settled.
            await streamPromise;
            try {
                await __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_drain).call(this);
            }
            catch (e) {
                __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").warn('drain failed', { error: String(e) });
            }
            __classPrivateFieldGet(this, _SessionToolRunner_results, "f").close();
            for (const t of this.tools) {
                try {
                    // `close` is typed `() => Promisable<void>`, so a single `await`
                    // covers both the sync and async return.
                    await t.close?.();
                }
                catch (e) {
                    __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").warn('tool.close failed', { tool: toolName(t), error: String(e) });
                }
            }
            // Detach from the external signal so the consumer can drop their signal
            // reference without leaking this iterator instance.
            __classPrivateFieldGet(this, _SessionToolRunner_detachExternal, "f").call(this);
        }
    }
}
_SessionToolRunner_requestOptions = function _SessionToolRunner_requestOptions() {
    return {
        ...__classPrivateFieldGet(this, _SessionToolRunner_requestOpts, "f"),
        headers: buildHeaders([{ 'x-stainless-helper': HELPER_NAME }, __classPrivateFieldGet(this, _SessionToolRunner_requestOpts, "f")?.headers]),
        signal: __classPrivateFieldGet(this, _SessionToolRunner_controller, "f").signal,
    };
}, _SessionToolRunner_streamLoop = 
// ===== event stream =====
async function _SessionToolRunner_streamLoop() {
    const ctrl = __classPrivateFieldGet(this, _SessionToolRunner_controller, "f");
    let backoff = STREAM_BACKOFF_START_MS;
    while (!ctrl.signal.aborted) {
        try {
            // Establish the event stream *before* reconciling history, so an event
            // emitted in the gap between listing and attaching is buffered on the
            // stream rather than lost. `seen`/`answered` dedup any event that shows
            // up both in the reconcile pass and on the live stream.
            const stream = await this.client.beta.sessions.events.stream(this.sessionId, {}, __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_requestOptions).call(this));
            await __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_reconcile).call(this);
            for await (const ev of stream) {
                backoff = STREAM_BACKOFF_START_MS;
                if (await __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_handleStreamEvent).call(this, ev))
                    return;
            }
        }
        catch (e) {
            // An abort throws to unwind the caller (the iterator's `streamPromise`
            // `.catch`) rather than returning early and letting it carry on.
            ctrl.signal.throwIfAborted();
            if (isFatal4xx(e)) {
                __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").error('permanent stream failure, shutting down', { error: String(e) });
                ctrl.abort();
                throw e;
            }
            __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").warn('stream disconnected, reconnecting', {
                error: String(e),
                backoff_ms: backoff,
            });
        }
        ctrl.signal.throwIfAborted();
        await sleep(backoff, ctrl.signal);
        backoff = Math.min(backoff * 2, STREAM_BACKOFF_CAP_MS);
    }
}, _SessionToolRunner_reconcile = 
/**
 * Read full history before dispatching so a `tool_use` whose result appears
 * later in the same history is not re-executed. Runs after the live stream is
 * already attached (see {@link SessionToolRunner.#streamLoop}).
 */
async function _SessionToolRunner_reconcile() {
    const ctrl = __classPrivateFieldGet(this, _SessionToolRunner_controller, "f");
    const pending = [];
    let lastWasEndTurn = false;
    try {
        for await (const ev of this.client.beta.sessions.events.list(this.sessionId, { limit: 1000 }, __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_requestOptions).call(this))) {
            __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_ingestHistory).call(this, ev, pending);
            lastWasEndTurn = isEndTurnIdle(ev);
        }
    }
    catch (e) {
        // An abort throws to unwind the caller; a real list failure is
        // non-fatal — undo the speculative `seen` entries and let `#streamLoop`
        // carry on with the live stream.
        ctrl.signal.throwIfAborted();
        __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").warn('reconcile list failed', { error: String(e) });
        // If list itself failed, undo the speculative `seen` entries so the next
        // reconcile pass (or the live stream) can pick them up. Leave the idle
        // timer untouched — the history we read may be incomplete.
        for (const ev of pending)
            __classPrivateFieldGet(this, _SessionToolRunner_seen, "f").delete(ev.id);
        return;
    }
    const unanswered = pending.filter((ev) => !__classPrivateFieldGet(this, _SessionToolRunner_answered, "f").has(ev.id));
    // If the most recent event in history is an `end_turn` idle and there's no
    // outstanding tool work, the session is done — arm the idle timer so the
    // runner stops even if that `end_turn` arrived during a disconnect.
    if (lastWasEndTurn && unanswered.length === 0)
        __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_armIdleTimer).call(this);
    else
        __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_disarmIdleTimer).call(this);
    for (const ev of unanswered)
        await __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_execute).call(this, ev);
}, _SessionToolRunner_ingestHistory = function _SessionToolRunner_ingestHistory(ev, pending) {
    if (ev.type === 'agent.tool_use' || ev.type === 'agent.custom_tool_use') {
        // Mark the event seen so a replay on the live stream is not dispatched
        // twice, but decide whether it still needs executing from `answered`, not
        // `seen`: a call whose result post failed is seen-but-unanswered, and must
        // be retried on the next reconcile pass rather than silently dropped.
        __classPrivateFieldGet(this, _SessionToolRunner_seen, "f").add(ev.id);
        if (!__classPrivateFieldGet(this, _SessionToolRunner_answered, "f").has(ev.id))
            pending.push(ev);
    }
    else if (ev.type === 'user.tool_result') {
        __classPrivateFieldGet(this, _SessionToolRunner_answered, "f").add(ev.tool_use_id);
    }
    else if (ev.type === 'user.custom_tool_result') {
        __classPrivateFieldGet(this, _SessionToolRunner_answered, "f").add(ev.custom_tool_use_id);
    }
}, _SessionToolRunner_handleStreamEvent = 
/** Returns true when the runner should exit. */
async function _SessionToolRunner_handleStreamEvent(ev) {
    // Arm/disarm the idle timer: an `end_turn` idle starts the grace countdown;
    // any other event cancels it.
    if (isEndTurnIdle(ev))
        __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_armIdleTimer).call(this);
    else
        __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_disarmIdleTimer).call(this);
    switch (ev.type) {
        case 'agent.tool_use':
        case 'agent.custom_tool_use':
            if (!__classPrivateFieldGet(this, _SessionToolRunner_seen, "f").has(ev.id)) {
                __classPrivateFieldGet(this, _SessionToolRunner_seen, "f").add(ev.id);
                await __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_execute).call(this, ev);
            }
            return false;
        case 'user.tool_result':
            __classPrivateFieldGet(this, _SessionToolRunner_answered, "f").add(ev.tool_use_id);
            return false;
        case 'user.custom_tool_result':
            __classPrivateFieldGet(this, _SessionToolRunner_answered, "f").add(ev.custom_tool_use_id);
            return false;
        case 'session.status_terminated':
        case 'session.deleted':
            __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").info('session terminated', {
                component: 'session-tool-runner',
                session_id: this.sessionId,
            });
            __classPrivateFieldGet(this, _SessionToolRunner_controller, "f").abort();
            return true;
        default:
            return false;
    }
}, _SessionToolRunner_armIdleTimer = function _SessionToolRunner_armIdleTimer() {
    __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_disarmIdleTimer).call(this);
    if (this.maxIdleMs <= 0)
        return;
    __classPrivateFieldSet(this, _SessionToolRunner_idleTimer, setTimeout(() => {
        __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").info('session idle after end_turn; stopping', {
            component: 'session-tool-runner',
            session_id: this.sessionId,
            max_idle_ms: this.maxIdleMs,
        });
        __classPrivateFieldGet(this, _SessionToolRunner_controller, "f").abort();
    }, this.maxIdleMs), "f");
}, _SessionToolRunner_disarmIdleTimer = function _SessionToolRunner_disarmIdleTimer() {
    if (__classPrivateFieldGet(this, _SessionToolRunner_idleTimer, "f") !== undefined) {
        clearTimeout(__classPrivateFieldGet(this, _SessionToolRunner_idleTimer, "f"));
        __classPrivateFieldSet(this, _SessionToolRunner_idleTimer, undefined, "f");
    }
}, _SessionToolRunner_execute = 
// ===== tool execution =====
async function _SessionToolRunner_execute(ev) {
    var _a, _b;
    if (__classPrivateFieldGet(this, _SessionToolRunner_answered, "f").has(ev.id))
        return;
    __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").info('executing tool', {
        component: 'session-tool-runner',
        session_id: this.sessionId,
        tool: ev.name,
        tool_use_id: ev.id,
    });
    __classPrivateFieldSet(this, _SessionToolRunner_inFlightCount, (_a = __classPrivateFieldGet(this, _SessionToolRunner_inFlightCount, "f"), _a++, _a), "f");
    try {
        const tool = __classPrivateFieldGet(this, _SessionToolRunner_toolByName, "f").get(ev.name);
        if (!tool) {
            // Skip (split-client partial fulfilment): a name this runner
            // is not registered for belongs to the other client servicing this
            // session (typically the customer's app backend handling custom tools).
            // Post NO result, do not mark it answered, and leave the tool_use_id
            // pending for its owner — claiming it would corrupt the conversation.
            // Still yield the call so the consumer can observe the unowned
            // dispatch; nothing was sent, so `posted`/`isError` stay false and no
            // `result` event is populated. The id stays unanswered, so reconcile
            // keeps it out of the idle/end-turn accounting and re-surfaces it after
            // a reconnect until its owner answers it.
            __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").info('tool not owned by this runner; leaving the tool_use_id pending for its owner', {
                component: 'session-tool-runner',
                session_id: this.sessionId,
                tool: ev.name,
                tool_use_id: ev.id,
            });
            __classPrivateFieldGet(this, _SessionToolRunner_results, "f").push({ event: ev, toolUseId: ev.id, name: ev.name, isError: false, posted: false });
            return;
        }
        let content;
        let isError;
        // Per-tool controller: aborts on the runner's own signal *or* the
        // per-tool timeout, so an in-flight tool stops promptly when the runner
        // is aborted instead of running until the timeout.
        const toolCtrl = new AbortController();
        const detachTool = linkAbort(__classPrivateFieldGet(this, _SessionToolRunner_controller, "f").signal, toolCtrl);
        const timer = setTimeout(() => toolCtrl.abort(), TOOL_TIMEOUT_MS);
        try {
            // Pass the source `agent.tool_use` / `agent.custom_tool_use` event
            // straight through as the run context's `toolUse` — it is a union
            // member of `BetaToolUse`, no Messages-block adapter needed.
            const outcome = await runRunnableTool(tool, ev.input, {
                toolUse: ev,
                toolUseBlock: ev,
                signal: toolCtrl.signal,
            });
            content = outcome.content;
            isError = outcome.isError;
        }
        finally {
            clearTimeout(timer);
            detachTool();
        }
        // Answer with the result event that matches the call kind: a
        // `user.tool_result` for an `agent.tool_use`, a `user.custom_tool_result`
        // for an `agent.custom_tool_use`. Posting the wrong one leaves the call
        // unanswered and the session stuck.
        const result = buildResultEvent(ev, isError, toSessionContent(content));
        const posted = await __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_sendResult).call(this, result, ev.id);
        __classPrivateFieldGet(this, _SessionToolRunner_results, "f").push({
            event: ev,
            result,
            toolUseId: ev.id,
            name: ev.name,
            isError,
            posted,
        });
    }
    finally {
        __classPrivateFieldSet(this, _SessionToolRunner_inFlightCount, (_b = __classPrivateFieldGet(this, _SessionToolRunner_inFlightCount, "f"), _b--, _b), "f");
        if (__classPrivateFieldGet(this, _SessionToolRunner_inFlightCount, "f") === 0)
            __classPrivateFieldGet(this, _SessionToolRunner_onIdle, "f")?.call(this);
    }
}, _SessionToolRunner_sendResult = async function _SessionToolRunner_sendResult(result, toolUseId) {
    const ctrl = __classPrivateFieldGet(this, _SessionToolRunner_controller, "f");
    let lastErr;
    for (let i = 0; i < SEND_RETRIES; i++) {
        // An abort throws to unwind the caller rather than returning a
        // `posted: false` result the iterator would carry on past.
        ctrl.signal.throwIfAborted();
        try {
            await this.client.beta.sessions.events.send(this.sessionId, { events: [result] }, __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_requestOptions).call(this));
            __classPrivateFieldGet(this, _SessionToolRunner_answered, "f").add(toolUseId);
            return true;
        }
        catch (e) {
            lastErr = e;
            // Only short-circuit on a permanent 4xx; 408/409/429 deserve the
            // remaining retries (aligned with the core client's retry policy).
            if (isFatal4xx(e))
                break;
            // Back off only *between* attempts — never after the final one, since
            // there is no further try left to wait for.
            if (i < SEND_RETRIES - 1)
                await sleep((i + 1) * 1000, ctrl.signal);
        }
    }
    __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").error('failed to send tool result', {
        tool_use_id: toolUseId,
        error: String(lastErr),
    });
    return false;
}, _SessionToolRunner_drain = 
/** Wait (bounded) for in-flight tool executions to finish during teardown. */
async function _SessionToolRunner_drain() {
    if (__classPrivateFieldGet(this, _SessionToolRunner_inFlightCount, "f") === 0)
        return;
    await Promise.race([new Promise((r) => (__classPrivateFieldSet(this, _SessionToolRunner_onIdle, r, "f"))), sleep(DRAIN_TIMEOUT_MS)]);
    __classPrivateFieldSet(this, _SessionToolRunner_onIdle, null, "f");
    if (__classPrivateFieldGet(this, _SessionToolRunner_inFlightCount, "f") > 0) {
        __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").warn('drain timeout exceeded');
    }
};
/**
 * Build the result event that answers `ev`: a `user.tool_result` for a builtin
 * `agent.tool_use`, a `user.custom_tool_result` for a custom
 * `agent.custom_tool_use`. The two `(use, result)` pairs are distinct API event
 * types and must be matched exactly — a `user.tool_result` does not answer a
 * custom tool call.
 */
function buildResultEvent(ev, isError, content) {
    if (ev.type === 'agent.custom_tool_use') {
        return { type: 'user.custom_tool_result', custom_tool_use_id: ev.id, is_error: isError, content };
    }
    return { type: 'user.tool_result', tool_use_id: ev.id, is_error: isError, content };
}
// The Messages-API tool-result block union is wider than the Sessions-API
// tool_result content union; pass through text/image/document and stringify
// anything else so a BetaRunnableTool authored for toolRunner still works here.
function toSessionContent(content) {
    if (typeof content === 'string')
        return [{ type: 'text', text: content || '(no output)' }];
    const out = content.map((b) => {
        if (b.type === 'text')
            return { type: 'text', text: b.text || '(no output)' };
        if (b.type === 'image' || b.type === 'document')
            return b;
        if (b.type === 'search_result') {
            // The Messages `search_result` block param maps field-for-field onto the
            // Sessions `BetaManagedAgentsSearchResultBlock`; map it explicitly rather
            // than letting it fall through to the JSON.stringify branch (which would
            // bury a structured result inside a text block). `citations` is required
            // on the Sessions side and optional on the Messages side — default the
            // flag to `false` when the producer left it unset.
            return {
                type: 'search_result',
                source: b.source,
                title: b.title,
                content: b.content.map((c) => ({ type: 'text', text: c.text })),
                citations: { enabled: b.citations?.enabled ?? false },
            };
        }
        return { type: 'text', text: JSON.stringify(b) };
    });
    return out.length > 0 ? out : [{ type: 'text', text: '(no output)' }];
}
//# sourceMappingURL=SessionToolRunner.mjs.map