import type { QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

export class QueryClient extends Context.Service<QueryClient, TanstackQueryClient>()(
  "@/common/QueryClient",
) {
  public static readonly make = (queryClient: TanstackQueryClient) =>
    Layer.succeed(QueryClient, queryClient);
}
