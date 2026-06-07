// Module-root re-exports of the gateway seam used by composition
// roots only:
//   - the `BillingGateway` Tag, parameterised at server-vs-test wiring.
//   - the two Live impls (`StripeBillingGatewayLive` prod,
//     `FakeBillingGatewayLive` tests) chosen at composition time.
//
// `index.ts` deliberately does NOT re-export `BillingGateway` (or any
// other outbound port). Per the `outbound-ports-private-to-use-cases`
// rule, ports are private to use cases — exposing one through the
// module barrel would create a hole where a controller could import
// the port via the barrel and skip the bus. The composition root
// reads this file directly (it lives outside the module folder, so
// the cross-module-barrel rule doesn't apply to it).
//
// `barrel-content-discipline` also forbids `index.ts` from reaching
// into `infrastructure/`, so the Live re-exports route through here
// for the same reason.

export { BillingGateway } from "./domain/ports/billing-gateway.js";
export {
  FAKE_WEBHOOK_SIGNATURE,
  FakeBillingGatewayLive,
} from "./infrastructure/fake-billing-gateway.js";
export { StripeBillingGatewayLive } from "./infrastructure/stripe-billing-gateway-live.js";
