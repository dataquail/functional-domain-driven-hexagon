import { ActiveTodosFetchedEvent } from 'src/core/domain/activeTodo/events/ActiveTodosFetchedEvent';
import { priorityTodoRepository } from 'src/core/infrastructure/repositories/PriorityTodoRepository';
import { PriorityTodo } from 'src/core/domain/priorityTodo/ports/IPriorityTodoRepository';

export const handleActiveTodosFetched = (event: unknown) => {
  if (event instanceof ActiveTodosFetchedEvent) {
    const activeIds = event.payload.ids;
    const reconciled: PriorityTodo[] = activeIds.map((id) => {
      const existing = priorityTodoRepository.getOneById({ id });
      return existing ?? { id, isPrioritized: false };
    });

    priorityTodoRepository.saveMany(reconciled);
  }
};
