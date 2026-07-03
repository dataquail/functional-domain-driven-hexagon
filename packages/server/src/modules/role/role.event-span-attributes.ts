import {
  roleGrantedSpanAttributes,
  roleRevokedSpanAttributes,
} from "@/modules/role/domain/role.events.js";
import { eventSpanAttributes } from "@/platform/ddd/ports/domain-event-bus.js";

export const roleEventSpanAttributes = eventSpanAttributes({
  RoleGranted: roleGrantedSpanAttributes,
  RoleRevoked: roleRevokedSpanAttributes,
});
