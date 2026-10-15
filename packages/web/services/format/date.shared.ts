// Date presentation, in one place.
//
// Hydration decodes through the endpoint's own schema, so a `Schema.DateTimeUtc`
// field is a real `DateTime.Utc` on the client as well as on the server. That is
// what lets this be a typed one-liner rather than a defensive "it might be a
// string, a Date, or an object with epochMillis" shim.

import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

export const formatDay = (value: DateTime.Utc): string => DateTime.formatIsoDateUtc(value);

export const formatOptionalDay = (value: Option.Option<DateTime.Utc>): Option.Option<string> =>
  Option.map(value, formatDay);
