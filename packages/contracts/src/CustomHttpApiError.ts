import * as HttpApiSchema from "@effect/platform/HttpApiSchema";
import * as Schema from "effect/Schema";

// ==========================================
// 4xx Client Errors
// ==========================================

export class BadRequest extends Schema.TaggedError<BadRequest>("BadRequest")(
  "BadRequest",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 400,
    description: "The request was invalid or cannot be otherwise served",
  }),
) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>("Unauthorized")(
  "Unauthorized",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 401,
    description: "Authentication is required and has failed or has not been provided",
  }),
) {}

export class PaymentRequired extends Schema.TaggedError<PaymentRequired>("PaymentRequired")(
  "PaymentRequired",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 402,
    description: "Payment is required to proceed",
  }),
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>("Forbidden")(
  "Forbidden",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 403,
    description: "The server understood the request but refuses to authorize it",
  }),
) {}

export class NotFound extends Schema.TaggedError<NotFound>("NotFound")(
  "NotFound",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 404,
    description: "The requested resource could not be found",
  }),
) {}

export class MethodNotAllowed extends Schema.TaggedError<MethodNotAllowed>("MethodNotAllowed")(
  "MethodNotAllowed",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 405,
    description: "The method specified in the request is not allowed for the resource",
  }),
) {}

export class NotAcceptable extends Schema.TaggedError<NotAcceptable>("NotAcceptable")(
  "NotAcceptable",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 406,
    description:
      "The resource identified by the request is only capable of generating response entities which have content characteristics not acceptable according to the accept headers sent in the request",
  }),
) {}

export class ProxyAuthenticationRequired extends Schema.TaggedError<ProxyAuthenticationRequired>(
  "ProxyAuthenticationRequired",
)(
  "ProxyAuthenticationRequired",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 407,
    description: "The client must first authenticate itself with the proxy",
  }),
) {}

export class RequestTimeout extends Schema.TaggedError<RequestTimeout>("RequestTimeout")(
  "RequestTimeout",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 408,
    description: "The server timed out waiting for the request",
  }),
) {}

export class Conflict extends Schema.TaggedError<Conflict>("Conflict")(
  "Conflict",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 409,
    description: "The resource already exists",
  }),
) {}

export class Gone extends Schema.TaggedError<Gone>("Gone")(
  "Gone",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 410,
    description: "The requested resource is no longer available and will not be available again",
  }),
) {}

export class LengthRequired extends Schema.TaggedError<LengthRequired>("LengthRequired")(
  "LengthRequired",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 411,
    description:
      "The request did not specify the length of its content, which is required by the requested resource",
  }),
) {}

export class PreconditionFailed extends Schema.TaggedError<PreconditionFailed>(
  "PreconditionFailed",
)(
  "PreconditionFailed",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 412,
    description:
      "The server does not meet one of the preconditions that the requester put on the request",
  }),
) {}

export class PayloadTooLarge extends Schema.TaggedError<PayloadTooLarge>("PayloadTooLarge")(
  "PayloadTooLarge",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 413,
    description: "The request is larger than the server is willing or able to process",
  }),
) {}

export class URITooLong extends Schema.TaggedError<URITooLong>("URITooLong")(
  "URITooLong",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 414,
    description: "The URI provided was too long for the server to process",
  }),
) {}

export class UnsupportedMediaType extends Schema.TaggedError<UnsupportedMediaType>(
  "UnsupportedMediaType",
)(
  "UnsupportedMediaType",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 415,
    description:
      "The request entity has a media type which the server or resource does not support",
  }),
) {}

export class RangeNotSatisfiable extends Schema.TaggedError<RangeNotSatisfiable>(
  "RangeNotSatisfiable",
)(
  "RangeNotSatisfiable",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 416,
    description:
      "The client has asked for a portion of the file, but the server cannot supply that portion",
  }),
) {}

export class ExpectationFailed extends Schema.TaggedError<ExpectationFailed>("ExpectationFailed")(
  "ExpectationFailed",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 417,
    description: "The server cannot meet the requirements of the Expect request-header field",
  }),
) {}

export class UnprocessableEntity extends Schema.TaggedError<UnprocessableEntity>(
  "UnprocessableEntity",
)(
  "UnprocessableEntity",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 422,
    description: "The request was well-formed but was unable to be followed due to semantic errors",
  }),
) {}

export class TooEarly extends Schema.TaggedError<TooEarly>("TooEarly")(
  "TooEarly",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 425,
    description: "The server is unwilling to risk processing a request that might be replayed",
  }),
) {}

export class TooManyRequests extends Schema.TaggedError<TooManyRequests>("TooManyRequests")(
  "TooManyRequests",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 429,
    description: "The user has sent too many requests in a given amount of time",
  }),
) {}

export class RequestHeaderFieldsTooLarge extends Schema.TaggedError<RequestHeaderFieldsTooLarge>(
  "RequestHeaderFieldsTooLarge",
)(
  "RequestHeaderFieldsTooLarge",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 431,
    description:
      "The server is unwilling to process the request because either an individual header field, or all the header fields collectively, are too large",
  }),
) {}

export class UnavailableForLegalReasons extends Schema.TaggedError<UnavailableForLegalReasons>(
  "UnavailableForLegalReasons",
)(
  "UnavailableForLegalReasons",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 451,
    description: "The server is denying access to the resource as a consequence of a legal demand",
  }),
) {}

// ==========================================
// 5xx Server Errors
// ==========================================

export class InternalServerError extends Schema.TaggedError<InternalServerError>(
  "InternalServerError",
)(
  "InternalServerError",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 500,
    description: "The server has encountered a situation it doesn't know how to handle",
  }),
) {}

export class NotImplemented extends Schema.TaggedError<NotImplemented>("NotImplemented")(
  "NotImplemented",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 501,
    description: "The request method is not supported by the server and cannot be handled",
  }),
) {}

export class BadGateway extends Schema.TaggedError<BadGateway>("BadGateway")(
  "BadGateway",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 502,
    description:
      "The server, while acting as a gateway or proxy, received an invalid response from the upstream server",
  }),
) {}

export class ServiceUnavailable extends Schema.TaggedError<ServiceUnavailable>(
  "ServiceUnavailable",
)(
  "ServiceUnavailable",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 503,
    description: "The server is not ready to handle the request",
  }),
) {}

export class GatewayTimeout extends Schema.TaggedError<GatewayTimeout>("GatewayTimeout")(
  "GatewayTimeout",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 504,
    description:
      "The server, while acting as a gateway or proxy, did not get a response in time from the upstream server",
  }),
) {}

export class HTTPVersionNotSupported extends Schema.TaggedError<HTTPVersionNotSupported>(
  "HTTPVersionNotSupported",
)(
  "HTTPVersionNotSupported",
  {
    message: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({
    status: 505,
    description: "The HTTP version used in the request is not supported by the server",
  }),
) {}
