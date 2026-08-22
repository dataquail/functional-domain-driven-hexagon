import { Card, type CardHeaderPadding } from "../primitives/card";
import { Heading, type HeadingAlign, type HeadingSize } from "../primitives/heading";
import { Stack } from "../primitives/stack";

// A titled card: the unit every page on this app is built out of. Bundling the
// card, its header and its heading means a page states *what the section is
// called*, not how a title is sized -- which is the decision that was being
// re-made, slightly differently, on fifteen call sites.

export type CardSectionProps = {
  readonly title: string;
  readonly titleSize?: HeadingSize;
  readonly titleAlign?: HeadingAlign;
  /** Rendered opposite the title -- a link or button acting on the section. */
  readonly action?: React.ReactNode;
  readonly headerPadding?: CardHeaderPadding;
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const CardSection: React.FC<CardSectionProps> = ({
  action,
  children,
  "data-testid": testId,
  headerPadding = "default",
  title,
  titleAlign = "start",
  titleSize = "xl",
}) => (
  <Card elevation="md" data-testid={testId}>
    <Card.Header padding={headerPadding}>
      {action === undefined ? (
        <Heading level={2} size={titleSize} align={titleAlign}>
          {title}
        </Heading>
      ) : (
        <Stack direction="row" gap="md" align="center" justify="between">
          <Heading level={2} size={titleSize} align={titleAlign}>
            {title}
          </Heading>
          {action}
        </Stack>
      )}
    </Card.Header>
    <Card.Content gap="lg">{children}</Card.Content>
  </Card>
);

export { CardSection };
