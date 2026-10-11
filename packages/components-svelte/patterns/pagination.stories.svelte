<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Pagination from "./pagination.svelte";

  const { Story } = defineMeta({
    title: "Patterns/Pagination",
    component: Pagination,
  });
</script>

<script lang="ts">
  let page = $state(1);
  const totalPages = 4;
</script>

<Story name="Controlled" asChild>
  <Pagination
    {page}
    {totalPages}
    total={37}
    itemLabel="users"
    hasPrevious={page > 1}
    hasNext={page < totalPages}
    onPrevious={() => (page -= 1)}
    onNext={() => (page += 1)}
  />
</Story>
