// The wiring surface: what the platform names to assemble and drive this module.
// What a peer module may reach is wallet.exports.ts, and it is empty — wallet's
// only inbound surface is an event adapter.
export { walletCommandGroup, WalletCommands } from "./wallet.command-handlers.js";
export { walletEventSpanAttributes } from "./wallet.event-span-attributes.js";
export { WalletModule } from "./wallet.module.js";
