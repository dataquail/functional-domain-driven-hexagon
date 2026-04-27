import { createReview } from 'src/core/domain/review/entities/Review';
import { activeTodoService } from 'src/core/infrastructure/services/ActiveTodoService';
import { reviewRepository } from 'src/core/infrastructure/repositories/ReviewRepository';
import { ChimericAsyncFactory } from '@chimeric/react';

export const startReviewUseCase = ChimericAsyncFactory(async () => {
  const activeTodoList = await activeTodoService.getAll();

  const todosToReviewIdList: string[] = activeTodoList
    .filter((activeTodo) => activeTodo.completedAt)
    .map((activeTodo) => activeTodo.id);

  const review = createReview(todosToReviewIdList);
  reviewRepository.save(review);
});
