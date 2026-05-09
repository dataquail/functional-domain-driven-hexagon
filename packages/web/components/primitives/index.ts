// Primitives barrel. Mirrors packages/client/src/components/primitives/index.ts
// but only exports the primitives ported into web so far. Phase 6 cutover
// either dedupes against the existing client or factors a shared component
// package per ADR-0015.
export * from "./badge";
export * from "./button";
export * from "./card";
export * from "./icon";
export * from "./skeleton";
