export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-4">
      <h1 className="text-3xl font-semibold">@org/web</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Next.js renderer scaffold (Phase 0). The same-origin proxy, server-side query
        infrastructure, and OTEL wiring land in subsequent phases — see ADR-0018 and
        docs/scratch/nextjs-migration-plan.md.
      </p>
    </main>
  );
}
