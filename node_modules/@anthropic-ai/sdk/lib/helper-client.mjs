import { AnthropicError } from "../core/error.mjs";
import { buildHeaders } from "../internal/headers.mjs";
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
export function copyClientForHelper(client, { authToken, helper }) {
    if (!authToken) {
        throw new AnthropicError(`copyClientForHelper: expected a non-empty authToken but received ${JSON.stringify(authToken)}`);
    }
    const internal = client;
    const parentDefaults = internal._options.defaultHeaders;
    // Carry the parent's credential/profile headers; strip the auth ones (we re-auth below).
    const parentAuthExtraHeaders = internal._authState?.extraHeaders;
    const inheritedAuthExtraHeaders = parentAuthExtraHeaders ?
        Object.fromEntries(Object.entries(parentAuthExtraHeaders).filter(([name]) => {
            const lower = name.toLowerCase();
            return lower !== 'authorization' && lower !== 'x-api-key';
        }))
        : undefined;
    const defaultHeaders = buildHeaders([
        inheritedAuthExtraHeaders,
        parentDefaults,
        { 'x-stainless-helper': helper },
    ]);
    return client.withOptions({
        apiKey: null,
        authToken,
        baseURL: client.baseURL,
        credentials: undefined,
        defaultHeaders,
    });
}
//# sourceMappingURL=helper-client.mjs.map