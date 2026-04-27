import { ChimericSync } from '@chimeric/react';

export type PriorityTodo = {
  id: string;
  isPrioritized: boolean;
};

export interface IPriorityTodoRepository {
  getOneById: ChimericSync<{ id: string }, PriorityTodo | undefined>;
  save: (priorityTodo: PriorityTodo) => void;
  saveMany: (priorityTodos: PriorityTodo[]) => void;
  delete: (args: { id: string }) => void;
}
