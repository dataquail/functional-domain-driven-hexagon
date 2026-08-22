// Device-approval page (ADR-0005). The CLI's `verification_uri_complete`
// links here with `?code=XXXX-XXXX`; the (authed) layout guard guarantees a
// signed-in caller, so approving binds the grant to the right user. Pure
// client interaction from here — the form posts to `/auth/device/approve`.

import { CardSection } from "@org/components/patterns/card-section";
import { PageShell } from "@org/components/patterns/page-shell";
import { Text } from "@org/components/primitives/text";
import React from "react";

import { ApproveDevice } from "@/features/device/approve-device/approve-device.view";

export default async function DeviceApprovalPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <PageShell width="xs">
      <CardSection title="Approve a device">
        <Text tone="muted">
          Enter the code shown in your terminal to authorize the CLI on your account.
        </Text>
        <ApproveDevice initialCode={code ?? ""} />
      </CardSection>
    </PageShell>
  );
}
