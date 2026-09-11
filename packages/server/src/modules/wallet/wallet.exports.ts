import { Module } from "@org/module";

// Nothing. Wallet's only inbound surface is an event adapter, so it is reached
// through the bus rather than by resolving anything it publishes.
export const walletExports = Module.exports();
