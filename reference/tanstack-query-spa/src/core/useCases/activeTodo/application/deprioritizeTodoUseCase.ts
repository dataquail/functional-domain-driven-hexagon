import { priorityTodoRepository } from 'src/core/infrastructure/repositories/PriorityTodoRepository';

export type DeprioritizeTodoUseCase = (args: { id: string }) => void;

export const deprioritizeTodoUseCase: DeprioritizeTodoUseCase = (args: {
  id: string;
}) => {
  const priorityTodo = priorityTodoRepository.getOneById({ id: args.id });

  if (!priorityTodo) {
    throw new Error('PriorityTodo not found');
  }

  if (!priorityTodo.isPrioritized) {
    throw new Error('ActiveTodo already deprioritized');
  }

  priorityTodoRepository.save({ id: args.id, isPrioritized: false });
};
