import * as Schema from "effect/Schema";

// ==========================================
// 4xx Client Errors
// ==========================================

export class BadRequest extends Schema.TaggedErrorClass<BadRequest>("BadRequest")(
  "BadRequest",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 400,
      description: "The request was invalid or cannot be otherwise served",
    },
) {}

export class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>("Unauthorized")(
  "Unauthorized",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 401,
      description: "Authentication is required and has failed or has not been provided",
    },
) {}

export class PaymentRequired extends Schema.TaggedErrorClass<PaymentRequired>("PaymentRequired")(
  "PaymentRequired",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 402,
      description: "Payment is required to proceed",
    },
) {}

export class Forbidden extends Schema.TaggedErrorClass<Forbidden>("Forbidden")(
  "Forbidden",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 403,
      description: "The server understood the request but refuses to authorize it",
    },
) {}

export class NotFound extends Schema.TaggedErrorClass<NotFound>("NotFound")(
  "NotFound",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 404,
      description: "The requested resource could not be found",
    },
) {}

export class MethodNotAllowed extends Schema.TaggedErrorClass<MethodNotAllowed>("MethodNotAllowed")(
  "MethodNotAllowed",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 405,
      description: "The method specified in the request is not allowed for the resource",
    },
) {}

export class NotAcceptable extends Schema.TaggedErrorClass<NotAcceptable>("NotAcceptable")(
  "NotAcceptable",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 406,
      description:
        "The resource identified by the request is only capable of generating response entities which have content characteristics not acceptable according to the accept headers sent in the request",
    },
) {}

export class ProxyAuthenticationRequired extends Schema.TaggedErrorClass<ProxyAuthenticationRequired>(
  "ProxyAuthenticationRequired",
)(
  "ProxyAuthenticationRequired",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 407,
      description: "The client must first authenticate itself with the proxy",
    },
) {}

export class RequestTimeout extends Schema.TaggedErrorClass<RequestTimeout>("RequestTimeout")(
  "RequestTimeout",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 408,
      description: "The server timed out waiting for the request",
    },
) {}

export class Conflict extends Schema.TaggedErrorClass<Conflict>("Conflict")(
  "Conflict",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 409,
      description: "The resource already exists",
    },
) {}

export class Gone extends Schema.TaggedErrorClass<Gone>("Gone")(
  "Gone",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 410,
      description: "The requested resource is no longer available and will not be available again",
    },
) {}

export class LengthRequired extends Schema.TaggedErrorClass<LengthRequired>("LengthRequired")(
  "LengthRequired",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 411,
      description:
        "The request did not specify the length of its content, which is required by the requested resource",
    },
) {}

export class PreconditionFailed extends Schema.TaggedErrorClass<PreconditionFailed>(
  "PreconditionFailed",
)(
  "PreconditionFailed",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 412,
      description:
        "The server does not meet one of the preconditions that the requester put on the request",
    },
) {}

export class PayloadTooLarge extends Schema.TaggedErrorClass<PayloadTooLarge>("PayloadTooLarge")(
  "PayloadTooLarge",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 413,
      description: "The request is larger than the server is willing or able to process",
    },
) {}

export class URITooLong extends Schema.TaggedErrorClass<URITooLong>("URITooLong")(
  "URITooLong",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 414,
      description: "The URI provided was too long for the server to process",
    },
) {}

export class UnsupportedMediaType extends Schema.TaggedErrorClass<UnsupportedMediaType>(
  "UnsupportedMediaType",
)(
  "UnsupportedMediaType",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 415,
      description:
        "The request entity has a media type which the server or resource does not support",
    },
) {}

export class RangeNotSatisfiable extends Schema.TaggedErrorClass<RangeNotSatisfiable>(
  "RangeNotSatisfiable",
)(
  "RangeNotSatisfiable",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 416,
      description:
        "The client has asked for a portion of the file, but the server cannot supply that portion",
    },
) {}

export class ExpectationFailed extends Schema.TaggedErrorClass<ExpectationFailed>("ExpectationFailed")(
  "ExpectationFailed",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 417,
      description: "The server cannot meet the requirements of the Expect request-header field",
    },
) {}

export class UnprocessableEntity extends Schema.TaggedErrorClass<UnprocessableEntity>(
  "UnprocessableEntity",
)(
  "UnprocessableEntity",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 422,
      description: "The request was well-formed but was unable to be followed due to semantic errors",
    },
) {}

export class TooEarly extends Schema.TaggedErrorClass<TooEarly>("TooEarly")(
  "TooEarly",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 425,
      description: "The server is unwilling to risk processing a request that might be replayed",
    },
) {}

export class TooManyRequests extends Schema.TaggedErrorClass<TooManyRequests>("TooManyRequests")(
  "TooManyRequests",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 429,
      description: "The user has sent too many requests in a given amount of time",
    },
) {}

export class RequestHeaderFieldsTooLarge extends Schema.TaggedErrorClass<RequestHeaderFieldsTooLarge>(
  "RequestHeaderFieldsTooLarge",
)(
  "RequestHeaderFieldsTooLarge",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 431,
      description:
        "The server is unwilling to process the request because either an individual header field, or all the header fields collectively, are too large",
    },
) {}

export class UnavailableForLegalReasons extends Schema.TaggedErrorClass<UnavailableForLegalReasons>(
  "UnavailableForLegalReasons",
)(
  "UnavailableForLegalReasons",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 451,
      description: "The server is denying access to the resource as a consequence of a legal demand",
    },
) {}

// ==========================================
// 5xx Server Errors
// ==========================================

export class InternalServerError extends Schema.TaggedErrorClass<InternalServerError>(
  "InternalServerError",
)(
  "InternalServerError",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 500,
      description: "The server has encountered a situation it doesn't know how to handle",
    },
) {}

export class NotImplemented extends Schema.TaggedErrorClass<NotImplemented>("NotImplemented")(
  "NotImplemented",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 501,
      description: "The request method is not supported by the server and cannot be handled",
    },
) {}

export class BadGateway extends Schema.TaggedErrorClass<BadGateway>("BadGateway")(
  "BadGateway",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 502,
      description:
        "The server, while acting as a gateway or proxy, received an invalid response from the upstream server",
    },
) {}

export class ServiceUnavailable extends Schema.TaggedErrorClass<ServiceUnavailable>(
  "ServiceUnavailable",
)(
  "ServiceUnavailable",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 503,
      description: "The server is not ready to handle the request",
    },
) {}

export class GatewayTimeout extends Schema.TaggedErrorClass<GatewayTimeout>("GatewayTimeout")(
  "GatewayTimeout",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 504,
      description:
        "The server, while acting as a gateway or proxy, did not get a response in time from the upstream server",
    },
) {}

export class HTTPVersionNotSupported extends Schema.TaggedErrorClass<HTTPVersionNotSupported>(
  "HTTPVersionNotSupported",
)(
  "HTTPVersionNotSupported",
  {
    message: Schema.optional(Schema.String),
  },
  {
      httpApiStatus: 505,
      description: "The HTTP version used in the request is not supported by the server",
    },
) {}
