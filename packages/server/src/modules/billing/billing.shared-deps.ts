// The one service in this module whose adapter differs between composition
// roots, published so a root can pick. Production takes Stripe; the test runtime
// takes the fake, the same way it takes a test database and a fake auth
// middleware. Everything else this module needs it provides itself.
export { BillingGatewayFake } from "./infrastructure/clients/billing-gateway.client-fake.js";
export { BillingGatewayLive } from "./infrastructure/clients/billing-gateway.client-live.js";
