import {
  userAddressUpdatedSpanAttributes,
  userCreatedSpanAttributes,
  userDeletedSpanAttributes,
} from "@/modules/user/domain/user-events.js";
import { eventSpanAttributes } from "@/platform/ddd/ports/domain-event-bus.js";

export const userEventSpanAttributes = eventSpanAttributes({
  UserCreated: userCreatedSpanAttributes,
  UserDeleted: userDeletedSpanAttributes,
  UserAddressUpdated: userAddressUpdatedSpanAttributes,
});
