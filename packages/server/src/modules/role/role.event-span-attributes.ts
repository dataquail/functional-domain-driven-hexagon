import { Event } from "@org/cqrs";

import {
  roleGrantedSpanAttributes,
  roleRevokedSpanAttributes,
} from "@/modules/role/domain/roles/role.events.js";

export const roleEventSpanAttributes = Event.spanAttributes({
  RoleGranted: roleGrantedSpanAttributes,
  RoleRevoked: roleRevokedSpanAttributes,
});
