import { Button } from "../primitives/button";
import { ChevronLeftIcon, ChevronRightIcon } from "../primitives/icon";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";

// Page position plus the two controls that change it. The pattern renders what
// it is told and reports intent upward -- deciding what "next" means belongs to
// the caller's ViewModel, not here.

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

const Pagination: React.FC<PaginationProps> = ({
  "data-testid": testId,
  hasNext,
  hasPrevious,
  itemLabel = "items",
  onNext,
  onPrevious,
  page,
  total,
  totalPages,
}) => (
  <Stack direction="row" align="center" justify="between" data-testid={testId}>
    <Text tone="muted">
      Page {page} of {totalPages} · {total} {itemLabel}
    </Text>
    <Stack direction="row" gap="sm" align="center">
      <Button
        variant="outline"
        size="icon"
        disabled={!hasPrevious}
        onClick={onPrevious}
        data-testid="pagination-previous"
      >
        <ChevronLeftIcon />
        <Text as="span" srOnly>
          Previous page
        </Text>
      </Button>
      <Button
        variant="outline"
        size="icon"
        disabled={!hasNext}
        onClick={onNext}
        data-testid="pagination-next"
      >
        <ChevronRightIcon />
        <Text as="span" srOnly>
          Next page
        </Text>
      </Button>
    </Stack>
  </Stack>
);

export { Pagination };
