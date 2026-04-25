import {
  userAddressUpdatedSpanAttributes,
  userCreatedSpanAttributes,
  userDeletedSpanAttributes,
  userRoleChangedSpanAttributes,
} from "@/modules/user/domain/user-events.js";
import { eventSpanAttributes } from "@/platform/domain-event-bus.js";

export const userEventSpanAttributes = eventSpanAttributes({
  UserCreated: userCreatedSpanAttributes,
  UserDeleted: userDeletedSpanAttributes,
  UserAddressUpdated: userAddressUpdatedSpanAttributes,
  UserRoleChanged: userRoleChangedSpanAttributes,
});
