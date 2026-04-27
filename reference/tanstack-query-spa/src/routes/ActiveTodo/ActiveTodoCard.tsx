import { formatDate } from 'src/utils/formatDate';
import { IconStar, IconStarFilled, IconTrash } from 'src/components/icons';
import { ActiveTodo } from 'src/core/domain/activeTodo/entities/ActiveTodo';
import { activeTodoService } from 'src/core/infrastructure/services/ActiveTodoService';
import { priorityTodoRepository } from 'src/core/infrastructure/repositories/PriorityTodoRepository';
import { prioritizeTodoUseCase } from 'src/core/useCases/activeTodo/application/prioritizeTodoUseCase';
import { deprioritizeTodoUseCase } from 'src/core/useCases/activeTodo/application/deprioritizeTodoUseCase';

type OwnProps = {
  todo: ActiveTodo;
};

export const ActiveTodoCard = ({ todo }: OwnProps) => {
  const priorityTodo = priorityTodoRepository.getOneById.useHook({
    id: todo.id,
  });
  const isPrioritized = priorityTodo?.isPrioritized ?? false;

  const completeOne = activeTodoService.completeOne.useHook();
  const uncompleteOne = activeTodoService.uncompleteOne.useHook();
  const deleteOne = activeTodoService.deleteOne.useHook();

  const isLoading =
    deleteOne.isPending || completeOne.isPending || uncompleteOne.isPending;

  return (
    <div className="todo-card">
      <div
        className={`checkbox-card ${todo.completedAt ? 'checked' : ''} ${deleteOne.isPending ? 'disabled' : ''}`}
        role="checkbox"
        aria-checked={!!todo.completedAt}
        onClick={() => {
          if (deleteOne.isPending) return;
          const isCompleted = Boolean(todo.completedAt);
          if (isCompleted) {
            uncompleteOne.invoke({ id: todo.id });
          } else {
            completeOne.invoke({ id: todo.id });
          }
        }}
      >
        {isLoading ? (
          <div className="loader loader-sm" style={{ margin: '0.5rem' }} />
        ) : (
          <div
            className={`checkbox-indicator ${todo.completedAt ? 'checked' : ''}`}
          />
        )}
        <div className="todo-info">
          <h4>{todo.title}</h4>
          <span className="text-sm">{`Created At: ${formatDate(todo.createdAt)}`}</span>
          <span className="text-sm">{`Completed At: ${todo.completedAt ? formatDate(todo.completedAt) : 'N/A'}`}</span>
        </div>
      </div>
      <button
        type="button"
        className={`icon-btn ${isPrioritized ? 'star-filled' : 'star'}`}
        onClick={() =>
          isPrioritized
            ? deprioritizeTodoUseCase({ id: todo.id })
            : prioritizeTodoUseCase({ id: todo.id })
        }
      >
        {isPrioritized ? <IconStarFilled /> : <IconStar />}
      </button>
      <button
        type="button"
        className="icon-btn danger"
        onClick={() => deleteOne.invoke({ id: todo.id })}
        disabled={deleteOne.isPending}
      >
        <IconTrash />
      </button>
    </div>
  );
};
