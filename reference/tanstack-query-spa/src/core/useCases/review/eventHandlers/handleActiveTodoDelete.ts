import { ActiveTodoDeletedEvent } from 'src/core/domain/activeTodo/events/ActiveTodoDeletedEvent';
import { reviewRepository } from 'src/core/infrastructure/repositories/ReviewRepository';

export const handleActiveTodoDelete = (event: unknown) => {
  if (event instanceof ActiveTodoDeletedEvent) {
    const review = reviewRepository.get();

    if (review) {
      reviewRepository.save({
        createdAt: review.createdAt,
        todoIdList: review.todoIdList.filter(
          (todoId) => todoId !== event.payload.id,
        ),
      });
    }
  }
};
