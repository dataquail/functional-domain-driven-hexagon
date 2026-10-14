<script module lang="ts">
  export type PaginationProps = {
    readonly page: number;
    readonly totalPages: number;
    readonly total: number;
    readonly hasPrevious: boolean;
    readonly hasNext: boolean;
    readonly onPrevious: () => void;
    readonly onNext: () => void;
    /** Plural noun for the counted thing, e.g. "users". */
    readonly itemLabel?: string;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  import Button from "../primitives/button.svelte";
  import { ChevronLeftIcon, ChevronRightIcon } from "../primitives/icon/icons";
  import Stack from "../primitives/stack.svelte";
  import Text from "../primitives/text.svelte";

  const {
    "data-testid": testId,
    hasNext,
    hasPrevious,
    itemLabel = "items",
    onNext,
    onPrevious,
    page,
    total,
    totalPages,
  }: PaginationProps = $props();
</script>

<Stack direction="row" align="center" justify="between" data-testid={testId}>
  <Text tone="muted">Page {page} of {totalPages} · {total} {itemLabel}</Text>
  <Stack direction="row" gap="sm" align="center">
    <Button
      variant="outline"
      size="icon"
      disabled={!hasPrevious}
      onClick={onPrevious}
      data-testid="pagination-previous"
    >
      <ChevronLeftIcon />
      <Text as="span" srOnly>Previous page</Text>
    </Button>
    <Button
      variant="outline"
      size="icon"
      disabled={!hasNext}
      onClick={onNext}
      data-testid="pagination-next"
    >
      <ChevronRightIcon />
      <Text as="span" srOnly>Next page</Text>
    </Button>
  </Stack>
</Stack>
