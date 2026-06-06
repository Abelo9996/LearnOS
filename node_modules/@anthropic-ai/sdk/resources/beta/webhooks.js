"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Webhooks = void 0;
const resource_1 = require("../../core/resource.js");
const standardwebhooks_1 = require("standardwebhooks");
class Webhooks extends resource_1.APIResource {
    unwrap(body, { headers, key }) {
        if (headers !== undefined) {
            const keyStr = key === undefined ? this._client.webhookKey : key;
            if (keyStr === null)
                throw new Error('Webhook key must not be null in order to unwrap');
            const wh = new standardwebhooks_1.Webhook(keyStr);
            wh.verify(body, headers);
        }
        return JSON.parse(body);
    }
}
exports.Webhooks = Webhooks;
//# sourceMappingURL=webhooks.js.map