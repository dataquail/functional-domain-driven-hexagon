import * as Cloudflare from "alchemy/Cloudflare";
import * as Neon from "alchemy/Neon";
import * as Layer from "effect/Layer";

export const stackProviders = Cloudflare.providers().pipe(Layer.provideMerge(Neon.providers()));
