import { archivedTodoService } from 'src/core/infrastructure/services/ArchivedTodoService';
import { ArchivedTodoCard } from './ArchivedTodoCard';
import { mapArchivedTodoDtoToArchivedTodo } from 'src/core/domain/archivedTodo/entities/ArchivedTodo';

export const ArchivedTodoList = () => {
  const { data, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } =
    archivedTodoService.getAll.useHook();

  if (isPending) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  const archivedTodos =
    data?.pages.flatMap((page) =>
      page.list.map(mapArchivedTodoDtoToArchivedTodo),
    ) ?? [];

  return (
    <div className="scroll-area">
      {archivedTodos.map((archivedTodo) => (
        <ArchivedTodoCard
          key={archivedTodo.id}
          archivedTodo={archivedTodo}
        />
      ))}
      {hasNextPage && (
        <div className="flex-center">
          <button
            type="button"
            className="btn btn-light"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <span className="loader loader-sm" />
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </div>
  );
};
