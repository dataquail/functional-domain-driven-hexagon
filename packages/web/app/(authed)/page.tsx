// Tasks index. Phase 3 ships a placeholder — Phase 4 ports the content
// from packages/client/src/features/index/ (view-model, todo-item,
// add-todo, primes/filter actions). The route exists at the same URL
// as the existing SPA so deep links survive.

export default function TasksPage() {
  return (
    <section className="mx-auto w-full max-w-2xl space-y-4 px-4">
      <div className="rounded-lg border bg-card p-6">
        <h1 className="mb-2 text-xl font-semibold">My Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Route placeholder. Phase 4 ports the todo list, AddTodo form, view-model, and worker
          actions from <code className="font-mono">packages/client/src/features/index/</code>.
        </p>
      </div>
    </section>
  );
}
