import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

// Creates the wallet for a freshly-created organization. Dispatched by the
// organization → wallet event adapter (interface/events), not by an HTTP
// endpoint — the only way to get a wallet is for an org to exist.
export const CreateWalletCommand = Schema.TaggedStruct("CreateWalletCommand", {
  organizationId: OrganizationId,
});
export type CreateWalletCommand = typeof CreateWalletCommand.Type;

export const createWalletCommandSpanAttributes: SpanAttributesExtractor<CreateWalletCommand> = (
  cmd,
) => ({ "organization.id": cmd.organizationId });
