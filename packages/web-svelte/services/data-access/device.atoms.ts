// Browser-side approval of a CLI device grant (ADR-0005): bind the grant
// identified by `userCode` to the signed-in caller. There is nothing to read
// here -- the page renders a form -- so this file is one mutation.

import { AuthContract } from "@org/contracts/api/Contracts";

import { ApiAtoms } from "@/services/atom/api-atoms.shared";

export const approveDeviceAtom = ApiAtoms.mutation("authDevice", "approve");

export const makeDeviceApprovalPayload = (userCode: string): AuthContract.DeviceApprovalPayload =>
  new AuthContract.DeviceApprovalPayload({ userCode });
