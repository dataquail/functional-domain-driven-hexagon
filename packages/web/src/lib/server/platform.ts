import { error } from "@sveltejs/kit";

// The one file that reads the Worker bindings the Alchemy stack declares.
export const serverBinding = (platform: App.Platform | undefined): Fetcher => {
  if (platform === undefined) error(500, "The server Worker binding is missing.");
  return platform.env.SERVER;
};
