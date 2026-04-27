import { formatDate } from 'src/utils/formatDate';
import { reviewRepository } from 'src/core/infrastructure/repositories/ReviewRepository';
import { startReviewUseCase } from 'src/core/useCases/review/application/startReviewUseCase';
import { getTodosUnderReviewUseCase } from 'src/core/useCases/review/application/getTodosUnderReviewUseCase';
import { finishReviewUseCase } from 'src/core/useCases/review/application/finishReviewUseCase';
import { activeTodoService } from 'src/core/infrastructure/services/ActiveTodoService';
import { TodoUnderReview } from 'src/core/domain/review/viewModels/out/TodoUnderReview';

const TodoUnderReviewCard = ({ todo }: { todo: TodoUnderReview }) => {
  const uncompleteOne = activeTodoService.uncompleteOne.useHook();
  const isExempted = !todo.completedAt;

  return (
    <div className="todo-card">
      <div
        className={`checkbox-card ${!isExempted ? 'checked' : ''} ${uncompleteOne.isPending ? 'disabled' : ''}`}
        role="checkbox"
        aria-checked={!isExempted}
        onClick={() => {
          if (!isExempted && !uncompleteOne.isPending) {
            uncompleteOne.invoke({ id: todo.id });
          }
        }}
      >
        {uncompleteOne.isPending ? (
          <div className="loader loader-sm" style={{ margin: '0.5rem' }} />
        ) : (
          <div
            className={`checkbox-indicator ${!isExempted ? 'checked' : ''}`}
          />
        )}
        <div className="todo-info">
          <h4 className={isExempted ? 'dimmed' : ''}>{todo.title}</h4>
          <span className="text-sm">{`Created At: ${formatDate(todo.createdAt)}`}</span>
          {isExempted && (
            <span className="text-sm text-dimmed text-italic">
              Uncompleted — will not be archived
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const ReviewContent = () => {
  const review = reviewRepository.get.useHook();
  const hasStartedReview = Boolean(review);
  const startReview = startReviewUseCase.useHook();
  const finishReview = finishReviewUseCase.useHook();
  const todosUnderReview = getTodosUnderReviewUseCase.useHook();

  return (
    <div>
      <div className="page-header">
        <h1>Review Completed Todos</h1>
        {hasStartedReview ? (
          <button
            type="button"
            className="btn"
            onClick={() => finishReview.invoke()}
            disabled={finishReview.isPending}
          >
            {finishReview.isPending ? (
              <span className="loader loader-sm" />
            ) : (
              'Archive & Finish'
            )}
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => startReview.invoke()}
            disabled={startReview.isPending}
          >
            {startReview.isPending ? (
              <span className="loader loader-sm" />
            ) : (
              'Start Review'
            )}
          </button>
        )}
      </div>
      <div className="spacer-lg" />
      {!hasStartedReview && (
        <p className="text-dimmed">
          Start a review to see all completed todos. Uncheck any you want to
          keep active. The rest will be archived when you finish.
        </p>
      )}
      {startReview.isPending || todosUnderReview.isPending ? (
        <div className="loader" />
      ) : (
        <div className="scroll-area">
          {todosUnderReview.data?.map((todo) => (
            <TodoUnderReviewCard key={todo.id} todo={todo} />
          ))}
        </div>
      )}
    </div>
  );
};
