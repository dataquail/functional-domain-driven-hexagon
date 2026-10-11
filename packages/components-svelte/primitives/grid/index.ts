import GridRoot from "./grid.svelte";
import GridItem from "./grid-item.part.svelte";

export type { GridColumns, GridGap, GridProps } from "./grid.svelte";
export type { GridItemProps } from "./grid-item.part.svelte";

export const Grid = Object.assign(GridRoot, { Item: GridItem });
