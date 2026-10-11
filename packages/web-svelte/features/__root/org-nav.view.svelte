<script lang="ts">
  // Org-scoped sub-nav. Billing and Invite are admin-only surfaces; hiding their
  // links is a UX affordance, the backend gates each endpoint independently.
  import Container from "@org/components-svelte/primitives/container.svelte";
  import Link from "@org/components-svelte/primitives/link.svelte";
  import Nav from "@org/components-svelte/primitives/nav.svelte";
  import Stack from "@org/components-svelte/primitives/stack.svelte";
  import Surface from "@org/components-svelte/primitives/surface.svelte";
  import type { OrganizationId } from "@org/contracts/EntityIds";

  const { isAdmin, orgId }: { readonly orgId: OrganizationId; readonly isAdmin: boolean } =
    $props();

  const linksFor = (
    base: string,
    admin: boolean,
  ): ReadonlyArray<{ href: string; label: string; testid: string }> => [
    { href: `${base}`, label: "Tasks", testid: "org-nav-tasks" },
    { href: `${base}/members`, label: "Members", testid: "org-nav-members" },
    ...(admin
      ? [
          { href: `${base}/billing`, label: "Billing", testid: "org-nav-billing" },
          { href: `${base}/invite`, label: "Invite", testid: "org-nav-invite" },
        ]
      : []),
  ];
</script>

<Surface tone="subtle" border="bottom">
  <Nav orientation="block" aria-label="Organization">
    <Container width="lg" paddingX="md" paddingY="xs">
      <Stack direction="row" gap="xs" align="center">
        {#each linksFor(`/orgs/${orgId}`, isAdmin) as link (link.href)}
          <Link
            href={link.href}
            appearance="nav-item"
            tone="muted"
            underline="none"
            data-testid={link.testid}
          >
            {link.label}
          </Link>
        {/each}
      </Stack>
    </Container>
  </Nav>
</Surface>
