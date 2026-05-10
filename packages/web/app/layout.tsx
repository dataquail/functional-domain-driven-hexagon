import "@org/components/styles/globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "@org/web",
  description: "Next.js renderer for the effect-monorepo template",
};

// Resolves the theme class on `<html>` synchronously, before the body
// paints, to avoid a light→dark flash on load. ThemeProvider's effects
// still own subsequent updates; this script just sets the initial class.
// Storage key MUST stay in sync with `storageKey` in
// components/providers/theme-provider.tsx.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("web-ui-theme");
    var theme = stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
    var actual = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    document.documentElement.classList.add(actual);
  } catch (_) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
