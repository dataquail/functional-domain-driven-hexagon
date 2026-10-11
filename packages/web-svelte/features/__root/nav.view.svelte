<script lang="ts">
  // Top-level nav for the authed shell. Super-admins don't own or join
  // organizations, so they see the admin links instead of the org switcher.
  import Container from "@org/components-svelte/primitives/container.svelte";
  import Link from "@org/components-svelte/primitives/link.svelte";
  import NavBar from "@org/components-svelte/primitives/nav.svelte";
  import Stack from "@org/components-svelte/primitives/stack.svelte";

  import OrgSwitcher from "./org-switcher/org-switcher.view.svelte";

  const { isSuperAdmin }: { readonly isSuperAdmin: boolean } = $props();
</script>

<NavBar orientation="block" tone="bar" aria-label="Main">
  <Container width="lg" paddingX="md" paddingY="sm">
    <Stack direction="row" gap="sm" align="center">
      <Link
        href={isSuperAdmin ? "/admin/orgs" : "/"}
        appearance="nav-item"
        tone="default"
        underline="none"
      >
        Home
      </Link>

      {#if !isSuperAdmin}
        <OrgSwitcher />
      {/if}

      <Stack direction="row" gap="xs" align="center" grow justify="end">
        {#if isSuperAdmin}
          <Link
            href="/users"
            appearance="nav-item"
            tone="default"
            underline="none"
            data-testid="nav-users"
          >
            Users
          </Link>
          <Link
            href="/admin/orgs"
            appearance="nav-item"
            tone="default"
            underline="none"
            data-testid="nav-admin"
          >
            Admin
          </Link>
        {/if}
        <Link
          href="/api/auth/logout"
          external
          appearance="nav-item"
          tone="default"
          underline="none"
        >
          Sign out
        </Link>
      </Stack>
    </Stack>
  </Container>
</NavBar>
