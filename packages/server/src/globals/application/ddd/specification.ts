import * as Data from "effect/Data";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";

// Criteria — a small, closed AST of predicates over an aggregate's ROOT-LEVEL
// scalar fields. It deliberately has no "some child row matches …" node: a spec
// can express `accepted_at IS NULL`, never `roles contains admin`. That keeps
// translation to a WHERE fragment sound (there is one root row to filter) and
// makes join-shaped filters *unconstructable* — a predicate that reaches into a
// child collection (e.g. OrganizationRolesSpecifications.hasRole) can only be a
// plain `Predicate`, never a `Specification`, so it can never be handed to a
// repository. Multi-table filtered loads are the repository's job (a two-phase
// id query it owns) or the read side, not this DSL. See criteria-to-sql.
export type Criteria = Data.TaggedEnum<{
  And: { readonly nodes: ReadonlyArray<Criteria> };
  Or: { readonly nodes: ReadonlyArray<Criteria> };
  Not: { readonly node: Criteria };
  IsNull: { readonly field: string };
  IsNotNull: { readonly field: string };
  Eq: { readonly field: string; readonly value: string | number | boolean };
}>;

export const Criteria = Data.taggedEnum<Criteria>();

// An eval-only predicate over a fully materialized aggregate: domain guards,
// the fake repository, post-load filtering. It carries no Criteria and so is
// never translatable to SQL.
export type Predicate<T> = (candidate: T) => boolean;

// A Specification is a Predicate that ALSO carries a translatable Criteria, so
// the same object filters in memory (fake, guards) and compiles to SQL (live
// repository). Every builder below produces one; there is no other way to make
// a Criteria, which is what bounds the DSL to root-level scalars.
export type Specification<T> = Predicate<T> & {
  readonly criteria: Criteria;
};

const make = <T>(predicate: Predicate<T>, criteria: Criteria): Specification<T> =>
  Object.assign(predicate, { criteria });

// An `Option` field is absent when `None`, which the SQL side reads as `IS NULL`.
const isAbsent = <V>(value: V): boolean =>
  (Option.isOption(value) && Option.isNone(value)) || P.isNull(value);

const isNull = <T>(field: keyof T & string): Specification<T> =>
  make<T>((candidate) => isAbsent(candidate[field]), Criteria.IsNull({ field }));

const isNotNull = <T>(field: keyof T & string): Specification<T> =>
  make<T>((candidate) => !isAbsent(candidate[field]), Criteria.IsNotNull({ field }));

const eq = <T, K extends keyof T & string>(
  field: K,
  value: Extract<T[K], string | number | boolean>,
): Specification<T> =>
  make<T>((candidate) => candidate[field] === value, Criteria.Eq({ field, value }));

const and = <T>(...specs: ReadonlyArray<Specification<T>>): Specification<T> =>
  make<T>(
    (candidate) => specs.every((spec) => spec(candidate)),
    Criteria.And({ nodes: specs.map((spec) => spec.criteria) }),
  );

const or = <T>(...specs: ReadonlyArray<Specification<T>>): Specification<T> =>
  make<T>(
    (candidate) => specs.some((spec) => spec(candidate)),
    Criteria.Or({ nodes: specs.map((spec) => spec.criteria) }),
  );

const not = <T>(spec: Specification<T>): Specification<T> =>
  make<T>((candidate) => !spec(candidate), Criteria.Not({ node: spec.criteria }));

export const Spec = { isNull, isNotNull, eq, and, or, not } as const;
