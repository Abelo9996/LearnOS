import type { Anthropic } from "../../client.js";
import type { BetaRunnableTool } from "../tools/BetaRunnableTool.js";
import type { BetaToolRunnerRequestOptions } from "../tools/BetaToolRunner.js";
import type { AgentToolContext } from "../../tools/agent-toolset/node.js";
/**
 * Either a fixed tool array or a factory invoked once per claimed session with
 * that session's {@link AgentToolContext} — use the factory form to bind
 * `betaAgentToolset20260401` (or any tool that needs the workdir / session
 * id) to the right session.
 */
export type EnvironmentWorkerTools = Array<BetaRunnableTool> | ((ctx: AgentToolContext) => Array<BetaRunnableTool>);
export interface EnvironmentWorkerOptions {
    client: Anthropic;
    /**
     * The self-hosted environment to poll for work. Required by
     * {@link EnvironmentWorker.run}; not used by {@link EnvironmentWorker.handleItem}.
     */
    environmentId?: string;
    /**
     * The environment key — the single credential for the runner. It authenticates
     * the work-poll calls and every per-session call (event stream, lease
     * heartbeat, force-stop). Required by {@link EnvironmentWorker.run}; falls back
     * to `ANTHROPIC_ENVIRONMENT_KEY` in {@link EnvironmentWorker.handleItem}.
     */
    environmentKey?: string;
    /**
     * Tools to expose to each claimed session. Defaults to
     * `betaAgentToolset20260401(ctx)` (the standard `agent_toolset_20260401` set
     * bound to the per-session {@link AgentToolContext}).
     */
    tools?: EnvironmentWorkerTools;
    /** Base directory for the per-session {@link AgentToolContext}. Defaults to `process.cwd()`. */
    workdir?: string;
    /** Forwarded to the per-session {@link AgentToolContext}. */
    unrestrictedPaths?: boolean;
    /** Forwarded to the per-session {@link AgentToolContext} (`maxFileBytes`). */
    maxFileBytes?: number | null;
    /** Forwarded to {@link SessionToolRunner} (`maxIdleMs`). */
    maxIdleMs?: number;
    /** Forwarded to the {@link WorkPoller}. */
    workerId?: string;
    /** External abort signal; aborting it ends the run. */
    signal?: AbortSignal;
    /**
     * Extra per-request options merged into every call this worker issues — the
     * work poll/ack/heartbeat/stop control-plane calls and the per-session
     * SessionToolRunner's stream/list/send. Mirrors what
     * `client.beta.messages.toolRunner` accepts: custom `headers` (e.g. a proxy's
     * auth/routing headers) reach all of them. The worker owns the abort signals,
     * so a `signal` here is ignored — use {@link EnvironmentWorkerOptions.signal}.
     */
    requestOptions?: BetaToolRunnerRequestOptions;
}
/**
 * Options for {@link EnvironmentWorker.handleItem}. Every field falls back to the
 * matching `ANTHROPIC_*` environment variable — the ones the
 * `ant worker poll --on-work` command sets for the process it spawns — when not
 * passed explicitly.
 */
export interface HandleItemOptions {
    /** Work item id. Falls back to `ANTHROPIC_WORK_ID`. */
    workId?: string;
    /** Self-hosted environment id. Falls back to `ANTHROPIC_ENVIRONMENT_ID`. */
    environmentId?: string;
    /** Session id. Falls back to `ANTHROPIC_SESSION_ID`. */
    sessionId?: string;
    /**
     * The environment key used to authenticate every per-session call. Resolution
     * order: this option, then the worker's own `environmentKey`, then
     * `ANTHROPIC_ENVIRONMENT_KEY`.
     */
    environmentKey?: string;
    /** External abort signal; aborting it ends the run. Defaults to the constructor's signal. */
    signal?: AbortSignal;
}
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
export declare class EnvironmentWorker {
    #private;
    readonly client: Anthropic;
    readonly environmentId: string | undefined;
    readonly environmentKey: string | undefined;
    readonly tools: EnvironmentWorkerTools | undefined;
    readonly workdir: string;
    readonly unrestrictedPaths: boolean | undefined;
    readonly maxFileBytes: number | null | undefined;
    readonly maxIdleMs: number | undefined;
    readonly workerId: string | undefined;
    readonly requestOptions: BetaToolRunnerRequestOptions | undefined;
    constructor(opts: EnvironmentWorkerOptions);
    /**
     * Poll the environment and service each claimed session until the supplied
     * signal (or the one passed to the constructor) aborts. Throws if
     * `environmentId` / `environmentKey` were not provided to the constructor.
     */
    run(signal?: AbortSignal): Promise<void>;
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
    handleItem(opts?: HandleItemOptions): Promise<void>;
}
//# sourceMappingURL=worker.d.ts.map