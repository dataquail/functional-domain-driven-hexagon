// Span attributes are simple key/value pairs. Restrict the value type to
// what `Effect.withSpan` accepts as a structured attribute — anything richer
// (objects, arrays of mixed types) becomes a per-key serialization headache
// that's better handled at the call site than papered over here.
export type SpanAttributeValue = string | number | boolean;

// A span-attribute extractor takes a value (a command, query, or event)
// and returns the attribute map to merge into its bus-level span. The
// extractor lives next to the schema definition (sibling exported function)
// and is composed into the bus at registration time. Returning `{}` is the
// safe default; only fields the extractor's author has audited as
// non-PHI/non-PII should appear in the result.
export type SpanAttributesExtractor<A> = (value: A) => Record<string, SpanAttributeValue>;
