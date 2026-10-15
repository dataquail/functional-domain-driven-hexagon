import CardRoot from "./card.svelte";
import CardContent from "./card-content.part.svelte";
import CardFooter from "./card-footer.part.svelte";
import CardHeader from "./card-header.part.svelte";

export type { CardElevation, CardInteractive, CardProps } from "./card.svelte";
export type { CardContentGap, CardContentProps } from "./card-content.part.svelte";
export type { CardFooterProps } from "./card-footer.part.svelte";
export type { CardHeaderPadding, CardHeaderProps } from "./card-header.part.svelte";

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Content: CardContent,
  Footer: CardFooter,
});
