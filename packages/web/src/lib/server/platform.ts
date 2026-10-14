import { error } from "@sveltejs/kit";
import * as Option from "effect/Option";

// The one file that reads the Worker bindings the Alchemy stack declares.
export const serverBinding = (platform: Option.Option<App.Platform>): Fetcher =>
  Option.match(platform, {
    onNone: () => error(500, "The server Worker binding is missing."),
    onSome: (bound) => bound.env.SERVER,
  });
