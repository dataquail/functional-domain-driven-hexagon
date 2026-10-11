import * as Context from "effect/Context";

export type IssuerTransportShape = {
  readonly fetch?: (url: string, init: RequestInit) => Promise<Response>;
};

// A Worker reaches the identity issuer through its service binding instead of the network.
export const IssuerTransport = Context.Reference<IssuerTransportShape>("IssuerTransport", {
  defaultValue: () => ({}),
});
