"use client";

import { useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { EmptyState } from "@org/components/patterns/empty-state";
import { Card } from "@org/components/primitives/card";
import { Grid } from "@org/components/primitives/grid";
import { Heading } from "@org/components/primitives/heading";
import { Link } from "@org/components/primitives/link";

import { myOrgsResultAtom, orgPickerAtom } from "./org-picker.view-model";

export const OrgPicker: React.FC = () => {
  useAtomSuspense(myOrgsResultAtom);
  const { cards, isEmpty } = useAtomValue(orgPickerAtom);

  if (isEmpty) {
    return (
      <EmptyState message="You don't belong to any organizations yet. Create one below to get started." />
    );
  }

  return (
    <Grid columnsAbove={2} gap="md" data-testid="org-picker">
      {cards.map((card) => (
        <Grid.Item key={card.id}>
          <Link
            href={card.href}
            block
            tone="inherit"
            underline="none"
            data-testid="org-picker-item"
          >
            <Card interactive="raise">
              <Card.Header>
                <Heading level={3} size="md">
                  {card.name}
                </Heading>
              </Card.Header>
            </Card>
          </Link>
        </Grid.Item>
      ))}
    </Grid>
  );
};
