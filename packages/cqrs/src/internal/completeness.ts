/**
 * The boot-time half of "is this application wired up?".
 *
 * A bus routes by tag against an erased table, so `bus.execute(SomeCommand, …)`
 * type-checks whether or not anything actually answers that tag. The gap that
 * leaves is a module whose dispatch surface was never merged at the composition
 * root: every call site still compiles, and the first dispatch of one of its tags
 * dies — possibly in production, on a rarely-exercised path. Comparing the table
 * against the groups the host says it composed turns that into a failure at
 * startup, where it is cheap.
 *
 * It cannot see a definition that was never put in a group at all; nothing
 * reachable from the bus can. That question belongs to whoever owns the modules,
 * and `Command.is` / `Query.is` are what let them ask it.
 *
 * Private to the package.
 */
export const assertEveryTagRoutable = (
  busName: string,
  routable: ReadonlySet<string>,
  declaredIn: ReadonlyArray<{ readonly tags: ReadonlyArray<string> }> | undefined,
): void => {
  if (declaredIn === undefined) return;

  const unroutable = [...new Set(declaredIn.flatMap((group) => group.tags))].filter(
    (tag) => !routable.has(tag),
  );
  if (unroutable.length === 0) return;

  throw new Error(
    `[${busName}] declared tags that nothing routes: ${unroutable
      .map((tag) => `'${tag}'`)
      .join(", ")}. Is every module's dispatch surface merged at the composition root?`,
  );
};
