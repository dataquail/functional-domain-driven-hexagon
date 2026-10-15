export type InvitationEmailProps = {
  readonly acceptUrl: string;
  readonly expiresLabel: string;
};

export type RenderedEmail = { readonly html: string; readonly text: string };

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Mail clients ignore stylesheets, so every style is inline.
export const invitationEmail = ({
  acceptUrl,
  expiresLabel,
}: InvitationEmailProps): RenderedEmail => {
  const url = escapeHtml(acceptUrl);
  const expires = escapeHtml(expiresLabel);

  return {
    html: `<!DOCTYPE html>
<html lang="en">
  <body style="background-color:#f6f7f9;font-family:${FONT};margin:0;padding:24px 0">
    <div style="background-color:#ffffff;margin:0 auto;padding:32px;max-width:480px;border-radius:8px">
      <h1 style="font-size:22px;font-weight:600;color:#111827">You're invited</h1>
      <p style="font-size:14px;line-height:22px;color:#374151">You've been invited to join an organization. Click the button below to accept the invitation and become a member.</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${url}" style="background-color:#111827;border-radius:6px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;padding:12px 20px">Accept invitation</a>
      </p>
      <p style="font-size:12px;line-height:18px;color:#6b7280">This invitation expires on ${expires}.</p>
      <hr style="border-color:#e5e7eb;margin:24px 0" />
      <p style="font-size:12px;line-height:18px;color:#6b7280">If the button doesn't work, copy and paste this link into your browser:<br /><a href="${url}" style="color:#2563eb">${url}</a></p>
    </div>
  </body>
</html>
`,
    text: `You're invited

You've been invited to join an organization. Accept the invitation and become a member:

${acceptUrl}

This invitation expires on ${expiresLabel}.
`,
  };
};
