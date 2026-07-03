/** @jsxRuntime automatic */
/** @jsxImportSource react */
// The pragmas above pin this file to the automatic JSX runtime regardless
// of which tsconfig the launcher resolves. Without them, a runtime that
// falls back to the classic transform (e.g. `tsx`/esbuild resolving the
// root tsconfig.json, whose `include: []` makes its `jsx` setting inert)
// emits `React.createElement` with no React in scope — "ReferenceError:
// React is not defined" at render time. tsc + vitest already use the
// automatic runtime via tsconfig.src.json; these make every other entry
// path (dev `tsx watch`, VSCode tasks, prod build) agree.
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// React Email template for the org invitation. Pure presentation: the
// adapter (`invitation-mailer-live.ts`) builds the `acceptUrl` and the
// human `expiresLabel`, then renders this to HTML + plaintext. Authoring
// emails as components is the whole point of the React Email choice —
// keep logic out of here.
export type InvitationEmailProps = {
  readonly acceptUrl: string;
  readonly expiresLabel: string;
};

const main = {
  backgroundColor: "#f6f7f9",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "32px",
  maxWidth: "480px",
  borderRadius: "8px",
};

const heading = { fontSize: "22px", fontWeight: 600, color: "#111827" };

const paragraph = { fontSize: "14px", lineHeight: "22px", color: "#374151" };

const button = {
  backgroundColor: "#111827",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 20px",
};

const muted = { fontSize: "12px", lineHeight: "18px", color: "#6b7280" };

const hr = { borderColor: "#e5e7eb", margin: "24px 0" };

export const InvitationEmail: React.FC<InvitationEmailProps> = ({ acceptUrl, expiresLabel }) => (
  <Html>
    <Head />
    <Preview>You&apos;ve been invited to join an organization</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>You&apos;re invited</Heading>
        <Text style={paragraph}>
          You&apos;ve been invited to join an organization. Click the button below to accept the
          invitation and become a member.
        </Text>
        <Section style={{ textAlign: "center", margin: "28px 0" }}>
          <Button href={acceptUrl} style={button}>
            Accept invitation
          </Button>
        </Section>
        <Text style={muted}>This invitation expires on {expiresLabel}.</Text>
        <Hr style={hr} />
        <Text style={muted}>
          If the button doesn&apos;t work, copy and paste this link into your browser:
          <br />
          <Link href={acceptUrl} style={{ color: "#2563eb" }}>
            {acceptUrl}
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
);
