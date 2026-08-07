import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

/**
 * The three ways a routing table can be wrong. All are wiring mistakes rather
 * than anything a call site can act on, so they arrive as defects — but as
 * *tagged* ones, because "the application is mis-wired" is exactly the condition
 * a host's boot check, or a test, wants to match on rather than parse out of a
 * message string.
 */
export class DuplicateDispatchTag extends Schema.TaggedErrorClass<DuplicateDispatchTag>()(
  "DuplicateDispatchTag",
  { tag: Schema.String },
) {
  override get message(): string {
    return `[DispatchTable] tag '${this.tag}' is claimed by more than one module`;
  }
}

/** A tag a group declared that no module's dispatch surface answers. */
export class UnroutableTags extends Schema.TaggedErrorClass<UnroutableTags>()("UnroutableTags", {
  bus: Schema.String,
  tags: Schema.Array(Schema.String),
}) {
  override get message(): string {
    return `[${this.bus}] declared tags that nothing routes: ${this.tags
      .map((tag) => `'${tag}'`)
      .join(", ")}. Is every module's dispatch surface merged at the composition root?`;
  }
}

/** A dispatch reached a bus for a tag its table has no entry for. */
export class MissingHandler extends Schema.TaggedErrorClass<MissingHandler>()("MissingHandler", {
  bus: Schema.String,
  tag: Schema.String,
}) {
  override get message(): string {
    return `[${this.bus}] no handler registered for '${this.tag}'`;
  }
}

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
        throw new DuplicateDispatchTag({ tag });
      }
      merged[tag] = dispatch;
    }
  }
  return merged;
};
