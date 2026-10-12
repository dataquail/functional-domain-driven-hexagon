<script lang="ts">
  import CreateUser from "@/features/users/create-user/create-user.view.svelte";
  import UserList from "@/features/users/user-list.view.svelte";
  import HydrationBoundary from "@/services/bridge/hydration-boundary.svelte";
</script>

<!-- The real route prefetches on the server; here UserList fetches through MSW. -->
<div>
  <CreateUser />
  <HydrationBoundary state={[]}>
    <UserList />
    {#snippet pending()}
      <div data-testid="users-loading"></div>
    {/snippet}
  </HydrationBoundary>
</div>
