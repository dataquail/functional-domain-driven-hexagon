import * as Schema from "effect/Schema";

export class AddressValueObject extends Schema.Class<AddressValueObject>("AddressValueObject")({
  country: Schema.String.pipe(Schema.isMinLength(2), Schema.isMaxLength(50)),
  street: Schema.String.pipe(Schema.isMinLength(2), Schema.isMaxLength(50)),
  postalCode: Schema.String.pipe(Schema.isMinLength(2), Schema.isMaxLength(10)),
}) {}
