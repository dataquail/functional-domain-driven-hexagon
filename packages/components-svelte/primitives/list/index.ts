import ListRoot from "./list.svelte";
import ListItem from "./list-item.part.svelte";

export type { ListElement, ListGap, ListMarker, ListProps } from "./list.svelte";
export type { ListItemProps } from "./list-item.part.svelte";

export const List = Object.assign(ListRoot, { Item: ListItem });
