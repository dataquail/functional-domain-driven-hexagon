import * as Schema from "effect/Schema";

export class Address extends Schema.Class<Address>("Address")({
  country: Schema.String.pipe(Schema.minLength(2), Schema.maxLength(50)),
  street: Schema.String.pipe(Schema.minLength(2), Schema.maxLength(50)),
  postalCode: Schema.String.pipe(Schema.minLength(2), Schema.maxLength(10)),
}) {}
