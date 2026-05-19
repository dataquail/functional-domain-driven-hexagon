import {
  userAddressUpdatedSpanAttributes,
  userCreatedSpanAttributes,
  userDeletedSpanAttributes,
  userDemotedFromSuperAdminSpanAttributes,
  userPromotedToSuperAdminSpanAttributes,
} from "@/modules/user/domain/user-events.js";
import { eventSpanAttributes } from "@/platform/ddd/domain-event-bus.js";

export const userEventSpanAttributes = eventSpanAttributes({
  UserCreated: userCreatedSpanAttributes,
  UserDeleted: userDeletedSpanAttributes,
  UserAddressUpdated: userAddressUpdatedSpanAttributes,
  UserPromotedToSuperAdmin: userPromotedToSuperAdminSpanAttributes,
  UserDemotedFromSuperAdmin: userDemotedFromSuperAdminSpanAttributes,
});
