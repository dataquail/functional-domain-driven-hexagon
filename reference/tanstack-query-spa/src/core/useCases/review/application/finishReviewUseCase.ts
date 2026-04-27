import { reviewRepository } from 'src/core/infrastructure/repositories/ReviewRepository';
import { archivedTodoService } from 'src/core/infrastructure/services/ArchivedTodoService';
import { ChimericAsyncFactory } from '@chimeric/react';

export const finishReviewUseCase = ChimericAsyncFactory(async () => {
  const review = reviewRepository.get();

  if (!review) {
    throw new Error('No review found');
  }

  await archivedTodoService.archiveCompleted({
    activeTodoIds: review.todoIdList,
  });

  reviewRepository.delete();
});
