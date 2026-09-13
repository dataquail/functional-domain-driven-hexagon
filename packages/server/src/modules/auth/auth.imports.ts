// Every other bounded context this module depends on, and exactly what it takes
// from each. This is the only file in the module permitted to name another
// module: an ACL adapter, an event adapter and the module's own assembly all
// reach a foreign name through here, so the whole inbound surface is one file to
// read and one file to review.

export { rolePeerQueries } from "@/modules/role/role.exports.js";
export { RoleModule } from "@/modules/role/role.module.js";
export { userProvisioningCommands } from "@/modules/user/user.exports.js";
export { UserModule } from "@/modules/user/user.module.js";
