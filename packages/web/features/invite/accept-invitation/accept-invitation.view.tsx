"use client";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button } from "@org/components/primitives/button";
import { Stack } from "@org/components/primitives/stack";
import { Text } from "@org/components/primitives/text";

import { acceptAtom, isAcceptingAtom } from "./accept-invitation.view-model";

export const AcceptInvitation: React.FC<{ readonly token: string }> = ({ token }) => {
  const isAccepting = useAtomValue(isAcceptingAtom);
  const accept = useAtomSet(acceptAtom);

  return (
    <Stack direction="column" gap="lg">
      <Text tone="muted">
        You&apos;ve been invited to join an organization. Click below to accept.
      </Text>
      <Button
        width="full"
        onClick={() => {
          accept(token);
        }}
        disabled={isAccepting}
        data-testid="invitation-accept"
      >
        {isAccepting ? "Accepting…" : "Accept invitation"}
      </Button>
    </Stack>
  );
};
