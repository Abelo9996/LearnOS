// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../core/resource.mjs";
import { Webhook } from 'standardwebhooks';
export class Webhooks extends APIResource {
    unwrap(body, { headers, key }) {
        if (headers !== undefined) {
            const keyStr = key === undefined ? this._client.webhookKey : key;
            if (keyStr === null)
                throw new Error('Webhook key must not be null in order to unwrap');
            const wh = new Webhook(keyStr);
            wh.verify(body, headers);
        }
        return JSON.parse(body);
    }
}
//# sourceMappingURL=webhooks.mjs.map