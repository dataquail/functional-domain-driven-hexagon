import type * as Effect from "effect/Effect";

/**
 * Erased view of a bus's routing table: message tag to a dispatch function whose
 * requirements are already discharged. `never` in argument position is the same
 * contravariance trick the span-attribute registries use — it lets the table hold
 * functions typed against their own concrete payloads, which a `Record<string,
 * unknown>` would reject. The by-tag lookup is what makes the call safe.
 */
export type DispatchTable = Readonly<
  Record<string, (payload: never) => Effect.Effect<unknown, unknown, never>>
>;

/**
 * Folds each module's dispatch surface into the one table a bus routes through. The result
 * is erased: a bus resolves a message's signature from the definition its caller passes,
 * not from the table. Modules are composed in dependency order at the composition root and
 * unified only here, which is what lets a module whose handlers reach another module
 * resolve against that module's dispatcher instead of the whole bus.
 *
 * Two modules claiming one tag is a wiring bug: the later contribution would silently win
 * and a message would be answered by the wrong module. Nothing catches that at compile
 * time now that the table is erased, so this check is the only guard — it runs once per
 * composition, at boot.
 */
export const mergeDispatchTables = (...tables: ReadonlyArray<DispatchTable>): DispatchTable => {
  const merged: Record<string, (payload: never) => Effect.Effect<unknown, unknown, never>> = {};
  for (const table of tables) {
    for (const [tag, dispatch] of Object.entries(table)) {
      if (tag in merged) {
        throw new Error(`[DispatchTable] tag '${tag}' is claimed by more than one module`);
      }
      merged[tag] = dispatch;
    }
  }
  return merged;
};
