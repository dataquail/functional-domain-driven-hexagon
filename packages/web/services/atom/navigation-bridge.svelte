<script lang="ts">
  // The one component that holds SvelteKit's router. Inbound: the current
  // pathname is mirrored into the graph on every navigation. Outbound: a
  // navigation request written by a ViewModel becomes a client-side `goto`.
  import { atomSet, atomSubscribe } from "@/services/bridge/atom-bridge.svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  import { type NavigationRequest, navigationRequestAtom, pathnameAtom } from "./navigation.shared";

  const setPathname = atomSet(pathnameAtom);

  // Set before the first render, so a View deriving from the path paints the
  // same thing on the server and in the browser.
  setPathname(page.url.pathname);

  $effect(() => {
    setPathname(page.url.pathname);
  });

  atomSubscribe(navigationRequestAtom, (request: NavigationRequest | null) => {
    if (request === null) return;
    void goto(request.href);
  });
</script>
