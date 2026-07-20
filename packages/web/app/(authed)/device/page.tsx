// Device-approval page (ADR-0005). The CLI's `verification_uri_complete`
// links here with `?code=XXXX-XXXX`; the (authed) layout guard guarantees a
// signed-in caller, so approving binds the grant to the right user. Pure
// client interaction from here — the form posts to `/auth/device/approve`.

import { Card } from "@org/components/primitives/card";

import { ApproveDevice } from "@/features/device/approve-device/approve-device.view";

export default async function DeviceApprovalPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4">
      <Card className="shadow-md">
        <Card.Header>
          <Card.Title className="text-2xl font-semibold">Approve a device</Card.Title>
        </Card.Header>
        <Card.Content>
          <p className="mb-4 text-sm text-muted-foreground">
            Enter the code shown in your terminal to authorize the CLI on your account.
          </p>
          <ApproveDevice initialCode={code ?? ""} />
        </Card.Content>
      </Card>
    </div>
  );
}
