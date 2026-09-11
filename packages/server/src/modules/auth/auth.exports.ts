import { Module } from "@org/module";

// Nothing. Auth reaches downward — it provisions users and asks role about super
// admins — and no module reaches back into it. Its dispatch surfaces are routed
// by the bus from the composition root, which is not a peer.
export const authExports = Module.exports();
