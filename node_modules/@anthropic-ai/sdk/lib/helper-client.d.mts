import type { Anthropic } from "../client.mjs";
/**
 * Shared util for building a runner-helper-bound sub-client.
 *
 * The work poller, the environment worker, and the session tool runner each
 * need to issue requests authenticated by a per-helper credential (a
 * self-hosted environment key, today) rather than the parent client's own
 * `X-Api-Key`, *and* tagged with their own `x-stainless-helper` telemetry
 * value. Each wants to inherit the parent's full configuration — `timeout`,
 * `maxRetries`, `fetch`, `fetchOptions`, custom `defaultHeaders`,
 * `defaultQuery` — and override only the auth + telemetry bits.
 *
 * {@link copyClientForHelper} is the one shared construction.
 */
/**
 * The closed set of `x-stainless-helper` telemetry tags the runner helpers
 * stamp on outgoing requests. Constrained as a string union so a typo at any
 * call site is a type error rather than silently mistagged telemetry.
 */
export type HelperTag = 'environments-work-poller' | 'environments-worker' | 'session-tool-runner';
/**
 * Return a `withOptions()` clone of `client` set up for use *by* one of the
 * runner helpers: authenticated with `authToken` as Bearer credentials, with
 * the parent's `X-Api-Key` cleared, and tagged with the helper's
 * `x-stainless-helper` value on every outgoing request.
 *
 * The returned sub-client inherits the parent's full configuration
 * (`baseURL`, `timeout`, `maxRetries`, `fetch`, `fetchOptions`, custom
 * `defaultHeaders`, `defaultQuery`). Overrides applied:
 *
 * - `authToken: authToken` — the new credential.
 * - `apiKey: null` — the parent's `X-Api-Key` is cleared. `withOptions`
 *   inherits the parent's `apiKey` by default; without this, both
 *   `X-Api-Key` *and* `Authorization: Bearer …` would land on the wire.
 *   `client.ts` only triggers the env-var fallback when `apiKey === undefined`,
 *   so explicit `null` is honored.
 * - `credentials: undefined` — opts the clone out of any inherited
 *   credentials/config/profile so the explicit bearer is the unambiguous auth.
 * - `baseURL: client.baseURL` — pins the parent's resolved host (auth override otherwise resets it).
 * - `defaultHeaders` is rebuilt as `parent._authState.extraHeaders ⊕ parent.defaultHeaders ⊕
 *   {'x-stainless-helper': helper}`. `withOptions` *replaces* (does not
 *   merge) `defaultHeaders`, so we merge here so any custom headers the
 *   caller set on the parent client survive on the sub-client.
 */
export declare function copyClientForHelper<T extends Anthropic>(client: T, { authToken, helper }: {
    authToken: string;
    helper: HelperTag;
}): T;
//# sourceMappingURL=helper-client.d.mts.map