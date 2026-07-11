import { type OrganizationRoot } from "./organization.root.js";

const isDeleted = (organization: OrganizationRoot): boolean => organization.deletedAt !== null;

export const OrganizationSpecifications = { isDeleted } as const;
