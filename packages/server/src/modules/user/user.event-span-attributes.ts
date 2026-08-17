import { Event } from "@effect-server-utils/cqrs";

import {
  userAddressUpdatedSpanAttributes,
  userCreatedSpanAttributes,
  userDeletedSpanAttributes,
} from "@/modules/user/domain/user/user.events.js";

export const userEventSpanAttributes = Event.spanAttributes({
  UserCreated: userCreatedSpanAttributes,
  UserDeleted: userDeletedSpanAttributes,
  UserAddressUpdated: userAddressUpdatedSpanAttributes,
});
