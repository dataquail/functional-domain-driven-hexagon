import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

// Creates the wallet for a freshly-created organization. Dispatched by the
// organization → wallet event adapter (interface/events), not by an HTTP
// endpoint — the only way to get a wallet is for an org to exist.
//
// Declaring the success and failure channels as schemas is what would let this
// command travel over a wire if the module were ever extracted; in-process the bus
// passes values by reference and never encodes them.
export const CreateWalletCommand = Command.make("CreateWalletCommand", {
  payload: { organizationId: OrganizationId },
  success: Schema.Void,
  failure: PersistenceUnavailable,
});
export type CreateWalletPayload = Command.Payload<typeof CreateWalletCommand>;
