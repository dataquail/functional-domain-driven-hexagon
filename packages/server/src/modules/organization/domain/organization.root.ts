import type * as DateTime from "effect/DateTime";
import * as Either from "effect/Either";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { OrganizationAlreadyDeleted, OrganizationNotDeleted } from "./organization.errors.js";
import {
  OrganizationCreated,
  type OrganizationEvent,
  OrganizationRestored,
  OrganizationSoftDeleted,
} from "./organization.events.js";

export class OrganizationRoot extends Schema.Class<OrganizationRoot>("OrganizationRoot")({
  id: OrganizationId,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
  // Soft-delete tombstone. Null = active. Set by `softDelete`, cleared
  // by `restore`. Reads filter on this column so callers don't see
  // tombstoned rows by default; the `restore` endpoint asks for them
  // explicitly via a flag on the read path.
  deletedAt: Schema.NullOr(Schema.DateTimeUtc),
}) {}

export type Result = {
  readonly organization: OrganizationRoot;
  readonly events: ReadonlyArray<OrganizationEvent>;
};

export type CreateInput = {
  readonly id: OrganizationId;
  readonly name: string;
  readonly now: DateTime.Utc;
};

const create = (input: CreateInput): Result => {
  const organization = OrganizationRoot.make({
    id: input.id,
    name: input.name,
    createdAt: input.now,
    updatedAt: input.now,
    deletedAt: null,
  });
  return {
    organization,
    events: [
      OrganizationCreated.make({ organizationId: organization.id, name: organization.name }),
    ],
  };
};

const isDeleted = (organization: OrganizationRoot): boolean => organization.deletedAt !== null;

export type SoftDeleteInput = { readonly now: DateTime.Utc };

// Aggregate-protected invariant: only an active org can be soft-deleted.
const softDelete = (
  organization: OrganizationRoot,
  input: SoftDeleteInput,
): Either.Either<Result, OrganizationAlreadyDeleted> => {
  if (isDeleted(organization)) {
    return Either.left(new OrganizationAlreadyDeleted({ organizationId: organization.id }));
  }
  return Either.right({
    organization: OrganizationRoot.make({
      id: organization.id,
      name: organization.name,
      createdAt: organization.createdAt,
      updatedAt: input.now,
      deletedAt: input.now,
    }),
    events: [OrganizationSoftDeleted.make({ organizationId: organization.id })],
  });
};

export type RestoreInput = { readonly now: DateTime.Utc };

// Aggregate-protected invariant: only a soft-deleted org can be restored.
const restore = (
  organization: OrganizationRoot,
  input: RestoreInput,
): Either.Either<Result, OrganizationNotDeleted> => {
  if (!isDeleted(organization)) {
    return Either.left(new OrganizationNotDeleted({ organizationId: organization.id }));
  }
  return Either.right({
    organization: OrganizationRoot.make({
      id: organization.id,
      name: organization.name,
      createdAt: organization.createdAt,
      updatedAt: input.now,
      deletedAt: null,
    }),
    events: [OrganizationRestored.make({ organizationId: organization.id })],
  });
};

export const OrganizationRootOps = { create, isDeleted, softDelete, restore } as const;
