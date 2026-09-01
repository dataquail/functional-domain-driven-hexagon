import * as Schema from "effect/Schema";

// These errors surface through oxlint's plugin loader, which prints a stack and
// nothing else. The `message` override is what turns "ConfigInvalid" into an
// instruction the reader can act on.

export class ConfigInvalid extends Schema.TaggedErrorClass<ConfigInvalid>("ConfigInvalid")(
  "ConfigInvalid",
  { configPath: Schema.String, detail: Schema.String },
) {
  override get message(): string {
    return `${this.configPath}: ${this.detail}`;
  }
}

export class PatternInvalid extends Schema.TaggedErrorClass<PatternInvalid>("PatternInvalid")(
  "PatternInvalid",
  {
    ruleName: Schema.String,
    field: Schema.String,
    pattern: Schema.String,
    detail: Schema.String,
  },
) {
  override get message(): string {
    return `rule "${this.ruleName}" has an uncompilable ${this.field} pattern ${JSON.stringify(
      this.pattern,
    )}: ${this.detail}`;
  }
}

export class ImportUnresolved extends Schema.TaggedErrorClass<ImportUnresolved>("ImportUnresolved")(
  "ImportUnresolved",
  {
    fromFile: Schema.String,
    specifier: Schema.String,
    detail: Schema.String,
  },
) {
  override get message(): string {
    return `${this.fromFile} imports "${this.specifier}", which does not resolve: ${this.detail}`;
  }
}
