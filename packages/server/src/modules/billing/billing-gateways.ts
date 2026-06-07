// Module-root re-exports of the gateway Lives. The dep-cruise rule
// `barrel-content-discipline` forbids `index.ts` from reaching into
// `infrastructure/`; routing them through this sibling keeps the
// public surface honest. The composition root (`server.ts`,
// `test-utils/test-server.ts`) imports both names from
// `@/modules/billing/index.js` and chooses prod-vs-fake.

export {
  FAKE_WEBHOOK_SIGNATURE,
  FakeBillingGatewayLive,
} from "./infrastructure/fake-billing-gateway.js";
export { StripeBillingGatewayLive } from "./infrastructure/stripe-billing-gateway-live.js";
