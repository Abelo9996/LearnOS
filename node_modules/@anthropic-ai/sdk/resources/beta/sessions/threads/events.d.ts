import { APIResource } from "../../../../core/resource.js";
import * as BetaAPI from "../../beta.js";
import * as EventsAPI from "../events.js";
import { BetaManagedAgentsSessionEventsPageCursor } from "../events.js";
import * as ThreadsAPI from "./threads.js";
import { APIPromise } from "../../../../core/api-promise.js";
import { type PageCursorParams, PagePromise } from "../../../../core/pagination.js";
import { Stream } from "../../../../core/streaming.js";
import { RequestOptions } from "../../../../internal/request-options.js";
export declare class Events extends APIResource {
    /**
     * List Session Thread Events
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const betaManagedAgentsSessionEvent of client.beta.sessions.threads.events.list(
     *   'sthr_011CZkZVWa6oIjw0rgXZpnBt',
     *   { session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(threadID: string, params: EventListParams, options?: RequestOptions): PagePromise<BetaManagedAgentsSessionEventsPageCursor, EventsAPI.BetaManagedAgentsSessionEvent>;
    /**
     * Stream Session Thread Events
     *
     * @example
     * ```ts
     * const betaManagedAgentsStreamSessionThreadEvents =
     *   await client.beta.sessions.threads.events.stream(
     *     'sthr_011CZkZVWa6oIjw0rgXZpnBt',
     *     { session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7' },
     *   );
     * ```
     */
    stream(threadID: string, params: EventStreamParams, options?: RequestOptions): APIPromise<Stream<ThreadsAPI.BetaManagedAgentsStreamSessionThreadEvents>>;
}
export interface EventListParams extends PageCursorParams {
    /**
     * Path param: Path parameter session_id
     */
    session_id: string;
    /**
     * Header param: Optional header to specify the beta version(s) you want to use.
     */
    betas?: Array<BetaAPI.AnthropicBeta>;
}
export interface EventStreamParams {
    /**
     * Path param: Path parameter session_id
     */
    session_id: string;
    /**
     * Header param: Optional header to specify the beta version(s) you want to use.
     */
    betas?: Array<BetaAPI.AnthropicBeta>;
}
export declare namespace Events {
    export { type EventListParams as EventListParams, type EventStreamParams as EventStreamParams };
}
export { type BetaManagedAgentsSessionEventsPageCursor };
//# sourceMappingURL=events.d.ts.map