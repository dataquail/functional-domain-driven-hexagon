import { PriorityTodo } from 'src/core/domain/priorityTodo/ports/IPriorityTodoRepository';
import { create } from 'zustand';

export type PriorityTodoRecord = {
  id: string;
  isPrioritized: boolean;
};

export type PriorityTodoDict = {
  [key: string]: PriorityTodoRecord | undefined;
};

export type PriorityTodoStore = {
  dict: PriorityTodoDict;
  save: (priorityTodo: PriorityTodo) => void;
  saveMany: (priorityTodos: PriorityTodo[]) => void;
  deletePriorityTodo: (args: { id: string }) => void;
};

export const usePriorityTodoStore = create<PriorityTodoStore>((set) => ({
  dict: {},
  save: (priorityTodo: PriorityTodo) =>
    set((state) => ({
      dict: {
        ...state.dict,
        [priorityTodo.id]: {
          id: priorityTodo.id,
          isPrioritized: priorityTodo.isPrioritized,
        },
      },
    })),
  saveMany: (priorityTodos: PriorityTodo[]) =>
    set((state) => ({
      dict: {
        ...state.dict,
        ...priorityTodos.reduce(
          (acc, todo) => {
            acc[todo.id] = {
              id: todo.id,
              isPrioritized: todo.isPrioritized,
            };
            return acc;
          },
          {} as PriorityTodoDict,
        ),
      },
    })),
  deletePriorityTodo: (args: { id: string }) =>
    set((state) => {
      const newDict = { ...state.dict };
      delete newDict[args.id];
      return { dict: newDict };
    }),
}));
