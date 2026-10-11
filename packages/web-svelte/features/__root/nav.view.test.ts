import { screen } from "@testing-library/svelte";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { renderView } from "@/test/atom-harness";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import Nav from "./nav.view.svelte";
import { orgSwitcherResultAtom } from "./org-switcher/org-switcher.view-model";

describe("Nav view", () => {
  it("gives a super-admin the admin links and sends Home to the admin area", () => {
    renderView(Nav, { isSuperAdmin: true });

    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/admin/orgs");
    expect(screen.getByTestId("nav-users")).toHaveAttribute("href", "/users");
    expect(screen.getByTestId("nav-admin")).toHaveAttribute("href", "/admin/orgs");
  });

  it("gives a member the org switcher instead of the admin links", () => {
    server.use(orgsHandlers.findMine([]));
    renderView(
      Nav,
      { isSuperAdmin: false },
      {
        initialValues: [
          [apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }],
          [orgSwitcherResultAtom, AsyncResult.success([])],
        ],
      },
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.queryByTestId("nav-users")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-admin")).not.toBeInTheDocument();
  });

  it("signs out through a full page load the BFF sees", () => {
    renderView(Nav, { isSuperAdmin: true });

    const signOut = screen.getByRole("link", { name: /sign out/i });
    expect(signOut).toHaveAttribute("href", "/api/auth/logout");
    expect(signOut).toHaveAttribute("data-sveltekit-reload");
  });
});
