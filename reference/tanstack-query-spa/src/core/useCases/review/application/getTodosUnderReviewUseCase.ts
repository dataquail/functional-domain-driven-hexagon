import { TodoUnderReview } from 'src/core/domain/review/viewModels/out/TodoUnderReview';
import { activeTodoService } from 'src/core/infrastructure/services/ActiveTodoService';
import { reviewRepository } from 'src/core/infrastructure/repositories/ReviewRepository';
import { ReactiveAsyncReducer } from '@chimeric/react-query';

export const getTodosUnderReviewUseCase = ReactiveAsyncReducer().build({
  serviceList: [
    { service: activeTodoService.getAll },
    { service: reviewRepository.get },
  ],
  reducer: ([activeTodoList, review]) => {
    if (!review) {
      return [];
    }

    return review.todoIdList.reduce((acc, todoUnderReviewId) => {
      const activeTodo = activeTodoList.find(
        (todo) => todo.id === todoUnderReviewId,
      );

      if (!activeTodo) {
        return acc;
      }

      return [
        ...acc,
        {
          id: activeTodo.id,
          title: activeTodo.title,
          createdAt: activeTodo.createdAt,
          completedAt: activeTodo.completedAt,
        },
      ];
    }, [] as TodoUnderReview[]);
  },
});
