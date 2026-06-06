"use strict";
var _EnvironmentWorker_instances, _EnvironmentWorker_signal, _EnvironmentWorker_handleItem;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentWorker = void 0;
const tslib_1 = require("../../internal/tslib.js");
const error_1 = require("../../core/error.js");
const log_1 = require("../../internal/utils/log.js");
const env_1 = require("../../internal/utils/env.js");
const sleep_1 = require("../../internal/utils/sleep.js");
const backoff_1 = require("../../internal/utils/backoff.js");
const abort_1 = require("../../internal/utils/abort.js");
const headers_1 = require("../../internal/headers.js");
const SessionToolRunner_1 = require("../tools/SessionToolRunner.js");
const poller_1 = require("./poller.js");
const helper_client_1 = require("../helper-client.js");
const HEARTBEAT_DEFAULT_MS = 30000;
const NO_HEARTBEAT_SENTINEL = 'NO_HEARTBEAT';
/**
 * The self-hosted environment runner, composed from the control-plane
 * {@link WorkPoller} and the per-session {@link SessionToolRunner}.
 *
 * For each claimed `session` work item it: builds the per-session
 * {@link AgentToolContext}, downloads the session agent's skills
 * (`setupSkills`), then runs a {@link SessionToolRunner} for the session
 * *while* heartbeating the work-item lease in parallel; on exit it force-stops
 * the work item, cleans up the downloaded skills, and loops to the next one. The
 * lease heartbeat reports `state === "stopping"` / a lost lease back into the run
 * by aborting the session runner.
 *
 * Use {@link EnvironmentWorker.handleItem} if you already hold a claimed work
 * item (e.g. a `worker poll --on-work` script handed one to a fresh process) and
 * just want the per-item flow without the poll loop — with no arguments it reads
 * the `ANTHROPIC_*` env vars that command sets.
 *
 * Construct it via `client.beta.environments.work.worker({ ... })` (or
 * `new EnvironmentWorker({ client, ... })` directly).
 *
 * @example
 * ```ts
 * // Long-running daemon: poll for work, serve each session, loop.
 * await client.beta.environments.work
 *   .worker({ environmentId, environmentKey, workdir: '/workspace' })
 *   .run(AbortSignal.timeout(60 * 60_000));
 *
 * // Already-claimed item (e.g. inside `ant worker poll --on-work ...`):
 * await client.beta.environments.work.worker({ workdir: '/workspace' }).handleItem();
 * ```
 */
class EnvironmentWorker {
    constructor(opts) {
        _EnvironmentWorker_instances.add(this);
        _EnvironmentWorker_signal.set(this, void 0);
        this.client = opts.client;
        this.environmentId = opts.environmentId;
        this.environmentKey = opts.environmentKey;
        this.tools = opts.tools;
        this.workdir = opts.workdir ?? process.cwd();
        this.unrestrictedPaths = opts.unrestrictedPaths;
        this.maxFileBytes = opts.maxFileBytes;
        this.maxIdleMs = opts.maxIdleMs;
        this.workerId = opts.workerId;
        this.requestOptions = opts.requestOptions;
        tslib_1.__classPrivateFieldSet(this, _EnvironmentWorker_signal, opts.signal, "f");
    }
    /**
     * Poll the environment and service each claimed session until the supplied
     * signal (or the one passed to the constructor) aborts. Throws if
     * `environmentId` / `environmentKey` were not provided to the constructor.
     */
    async run(signal) {
        const { environmentId, environmentKey } = this;
        if (environmentId === undefined || environmentKey === undefined) {
            throw new error_1.AnthropicError('EnvironmentWorker.run: environmentId and environmentKey are required to poll for work');
        }
        const externalSignal = signal ?? tslib_1.__classPrivateFieldGet(this, _EnvironmentWorker_signal, "f");
        const poller = new poller_1.WorkPoller({
            client: this.client,
            environmentId,
            environmentKey,
            ...(this.workerId !== undefined ? { workerId: this.workerId } : {}),
            ...(externalSignal ? { signal: externalSignal } : {}),
            ...(this.requestOptions !== undefined ? { requestOptions: this.requestOptions } : {}),
            // The per-item handler force-stops every work item on exit; let it be the
            // single owner of `work.stop` rather than double-posting from the poller.
            autoStop: false,
        });
        for await (const work of poller) {
            await tslib_1.__classPrivateFieldGet(this, _EnvironmentWorker_instances, "m", _EnvironmentWorker_handleItem).call(this, work, environmentKey, poller.signal);
        }
    }
    /**
     * Service a single, already-claimed work item without the poll loop: build the
     * per-session {@link AgentToolContext} (workdir from this worker's options),
     * download the session agent's skills (`setupSkills`), run a
     * {@link SessionToolRunner} for the session while heartbeating the work-item
     * lease in parallel, and force-stop the work item on exit (whether the runner
     * finishes normally, throws, or the heartbeat loop signals shutdown).
     *
     * Use this when something else does the claiming — e.g. a `worker poll
     * --on-work` script that hands an already-claimed item to a fresh process. The
     * work id / environment id / session id each fall back to `ANTHROPIC_WORK_ID` /
     * `ANTHROPIC_ENVIRONMENT_ID` / `ANTHROPIC_SESSION_ID` (the env vars that
     * command sets) when not passed; the environment key resolves from this
     * option, then the worker's own `environmentKey`, then
     * `ANTHROPIC_ENVIRONMENT_KEY`. With no arguments inside that command it just
     * works. Throws a clear error naming the first of the four required values
     * still missing after resolution.
     */
    async handleItem(opts) {
        const workId = opts?.workId ?? (0, env_1.readEnv)('ANTHROPIC_WORK_ID');
        const environmentId = opts?.environmentId ?? (0, env_1.readEnv)('ANTHROPIC_ENVIRONMENT_ID');
        const sessionId = opts?.sessionId ?? (0, env_1.readEnv)('ANTHROPIC_SESSION_ID');
        const environmentKey = opts?.environmentKey ?? this.environmentKey ?? (0, env_1.readEnv)('ANTHROPIC_ENVIRONMENT_KEY');
        if (!workId) {
            throw new error_1.AnthropicError('handleItem: workId is required — pass it or set ANTHROPIC_WORK_ID');
        }
        if (!environmentId) {
            throw new error_1.AnthropicError('handleItem: environmentId is required — pass it or set ANTHROPIC_ENVIRONMENT_ID');
        }
        if (!sessionId) {
            throw new error_1.AnthropicError('handleItem: sessionId is required — pass it or set ANTHROPIC_SESSION_ID');
        }
        if (!environmentKey) {
            throw new error_1.AnthropicError('handleItem: environmentKey is required — pass it, construct the worker with it, or set ANTHROPIC_ENVIRONMENT_KEY');
        }
        const work = {
            id: workId,
            environment_id: environmentId,
            data: { type: 'session', id: sessionId },
        };
        await tslib_1.__classPrivateFieldGet(this, _EnvironmentWorker_instances, "m", _EnvironmentWorker_handleItem).call(this, work, environmentKey, opts?.signal ?? tslib_1.__classPrivateFieldGet(this, _EnvironmentWorker_signal, "f"));
    }
}
exports.EnvironmentWorker = EnvironmentWorker;
_EnvironmentWorker_signal = new WeakMap(), _EnvironmentWorker_instances = new WeakSet(), _EnvironmentWorker_handleItem = 
/**
 * The per-item body shared by {@link EnvironmentWorker.run}'s poll loop and
 * {@link EnvironmentWorker.handleItem}: run a {@link SessionToolRunner} for the
 * work item's session while heartbeating its lease, force-stopping on exit.
 * Non-session work items are ignored.
 */
async function _EnvironmentWorker_handleItem(work, environmentKey, externalSignal) {
    const log = (0, log_1.loggerFor)(this.client);
    // Every per-session call — the SessionToolRunner event stream/list/send, the
    // lease heartbeat, and the work force-stop — authenticates with the
    // environment key. Scope a client to it once and thread that through.
    // `copyClientForHelper` also clears the parent's `apiKey`, so the sub-client
    // emits *only* the bearer credential on the wire (a plain
    // `withOptions({authToken})` would leave `X-Api-Key` set as well).
    const sessionClient = (0, helper_client_1.copyClientForHelper)(this.client, {
        authToken: environmentKey,
        helper: 'environments-worker',
    });
    // The poller runs with `autoStop: false`, so the per-item handler is the
    // single owner of `work.stop` for every claimed item.
    const sessionId = work.data.id;
    const ctx = {
        workdir: this.workdir,
        client: this.client,
        sessionId,
        ...(this.unrestrictedPaths !== undefined ? { unrestrictedPaths: this.unrestrictedPaths } : {}),
        ...(this.maxFileBytes !== undefined ? { maxFileBytes: this.maxFileBytes } : {}),
    };
    // Lazily load the Node-only toolset module — see the import note at the top.
    const agentToolset = await Promise.resolve().then(() => tslib_1.__importStar(require("../../tools/agent-toolset/node.js")));
    let cleanupSkills = async () => { };
    try {
        cleanupSkills = await agentToolset.setupSkills(ctx);
    }
    catch (e) {
        log.warn('skill setup failed', { session_id: sessionId, work_id: work.id, error: String(e) });
    }
    const tools = typeof this.tools === 'function' ?
        this.tools(ctx)
        : this.tools ?? agentToolset.betaAgentToolset20260401(ctx);
    // A per-session controller: aborts when the supplied signal aborts, when the
    // session runner finishes, or when the lease heartbeat says to stop.
    const ctrl = new AbortController();
    const detachExternal = (0, abort_1.linkAbort)(externalSignal, ctrl);
    const heartbeatPromise = heartbeatLoop(sessionClient, work, ctrl, log, this.requestOptions).catch((e) => {
        if (!ctrl.signal.aborted)
            log.error('heartbeat loop failed', { work_id: work.id, error: String(e) });
        ctrl.abort();
    });
    try {
        const runner = new SessionToolRunner_1.SessionToolRunner(sessionId, {
            client: sessionClient,
            tools,
            ...(this.maxIdleMs !== undefined ? { maxIdleMs: this.maxIdleMs } : {}),
            ...(this.requestOptions !== undefined ? { requestOptions: this.requestOptions } : {}),
            signal: ctrl.signal,
        });
        for await (const _ of runner) {
            // Drive the runner to completion; per-call observability is not part
            // of this composition's surface — use `SessionToolRunner` directly
            // (via `client.beta.sessions.events.toolRunner`) if you want it.
        }
    }
    finally {
        ctrl.abort();
        detachExternal();
        await heartbeatPromise;
        await cleanupSkills().catch((e) => {
            log.warn('skill cleanup failed', { session_id: sessionId, work_id: work.id, error: String(e) });
        });
        await forceStop(sessionClient, work, log, this.requestOptions);
    }
};
/** Force-stop a claimed work item, swallowing the 409 that means it's already stopped. */
async function forceStop(client, work, log, requestOptions) {
    try {
        await client.beta.environments.work.stop(work.id, { environment_id: work.environment_id, force: true }, 
        // Caller's headers pass through; the helper-tag header is on the scoped
        // sub-client's default_headers via copyClientForHelper, so no per-call
        // re-stamping needed.
        { ...requestOptions, headers: (0, headers_1.buildHeaders)([requestOptions?.headers]) });
    }
    catch (e) {
        if (!(0, backoff_1.isStatus)(e, 409)) {
            log.error('force-stop on exit failed', { work_id: work.id, error: String(e) });
        }
    }
}
/**
 * Keep the work-item lease alive while a session is being served. Aborts `ctrl`
 * when the control plane reports the work is `stopping`/`stopped`, when the
 * lease is no longer extended, or on a permanent heartbeat failure.
 */
async function heartbeatLoop(client, work, ctrl, logger, requestOptions) {
    let intervalMs = HEARTBEAT_DEFAULT_MS;
    let last = NO_HEARTBEAT_SENTINEL;
    const beat = async () => {
        try {
            const resp = await client.beta.environments.work.heartbeat(work.id, { environment_id: work.environment_id, expected_last_heartbeat: last }, { ...requestOptions, headers: (0, headers_1.buildHeaders)([requestOptions?.headers]), signal: ctrl.signal });
            last = resp.last_heartbeat;
            if (resp.ttl_seconds > 0) {
                intervalMs = Math.max(1000, Math.min((resp.ttl_seconds * 1000) / 2, HEARTBEAT_DEFAULT_MS));
            }
            if (resp.state === 'stopping' || resp.state === 'stopped') {
                logger.info('heartbeat signals shutdown', { work_id: work.id, state: resp.state });
                ctrl.abort();
            }
            if (!resp.lease_extended) {
                logger.warn('lease not extended, shutting down', { work_id: work.id });
                ctrl.abort();
            }
        }
        catch (e) {
            // An abort throws to unwind the caller (the `heartbeatLoop(...).catch`
            // in `#handleItem`) rather than returning early.
            ctrl.signal.throwIfAborted();
            if ((0, backoff_1.isFatal4xx)(e)) {
                logger.error('permanent heartbeat failure', { work_id: work.id, error: String(e) });
                ctrl.abort();
                throw e;
            }
            logger.warn('transient heartbeat failure', { work_id: work.id, error: String(e) });
        }
    };
    await beat();
    while (!ctrl.signal.aborted) {
        await (0, sleep_1.sleep)(intervalMs, ctrl.signal);
        ctrl.signal.throwIfAborted();
        await beat();
    }
}
//# sourceMappingURL=worker.js.map