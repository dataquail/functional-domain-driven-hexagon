<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Pagination from "./pagination.svelte";

  const { Story } = defineMeta({
    title: "Patterns/Pagination",
    component: Pagination,
  });
</script>

<script lang="ts">
  const pager = $state({ page: 1 });
  const totalPages = 4;
</script>

<Story name="Controlled" asChild>
  <Pagination
    page={pager.page}
    {totalPages}
    total={37}
    itemLabel="users"
    hasPrevious={pager.page > 1}
    hasNext={pager.page < totalPages}
    onPrevious={() => (pager.page -= 1)}
    onNext={() => (pager.page += 1)}
  />
</Story>
