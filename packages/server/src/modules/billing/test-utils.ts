// Module-root re-export of the test-only fake-signature constant.
// `barrel-content-discipline` forbids `index.ts` from reaching into
// `infrastructure/`; this neighbour file is the indirection. Kept
// narrow: just the constant tests use as the `stripe-signature`
// header so `FakeBillingGatewayLive` accepts the payload.

export { FAKE_WEBHOOK_SIGNATURE } from "./infrastructure/fake-billing-gateway.js";
