// Every other bounded context this module depends on, and exactly what it takes
// from each: the messages it dispatches, the domain events it reacts to, and any
// service a peer offers. Nothing about how the application is wired — a Layer is
// not something this module depends on, it is how an assembly happens to satisfy
// what it depends on. This is the only file here permitted to name another
// module's vocabulary, so the whole coupling surface is one file to review.

export { organizationAccessQueries } from "@/modules/organization/organization.exports.js";
export { roleAccessQueries } from "@/modules/role/role.exports.js";
