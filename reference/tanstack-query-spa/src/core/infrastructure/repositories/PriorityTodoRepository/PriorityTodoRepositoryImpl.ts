import {
  IPriorityTodoRepository,
  PriorityTodo,
} from 'src/core/domain/priorityTodo/ports/IPriorityTodoRepository';
import {
  PriorityTodoRecord,
  PriorityTodoStore,
  usePriorityTodoStore,
} from './priorityTodoStore';
import { CreateChimericSyncFactory } from '@chimeric/react';

const ChimericSyncFactory = CreateChimericSyncFactory<PriorityTodoStore>({
  getState: () => usePriorityTodoStore.getState(),
  useSelector: usePriorityTodoStore,
});

const toDomain = (record: PriorityTodoRecord): PriorityTodo => ({
  id: record.id,
  isPrioritized: record.isPrioritized,
});

export const createPriorityTodoRepository = (): IPriorityTodoRepository => ({
  getOneById: ChimericSyncFactory({
    selector: (args: { id: string }) => (state) => state.dict[args.id],
    reducer: (record) => (record ? toDomain(record) : undefined),
  }),
  save: (priorityTodo: PriorityTodo) => {
    usePriorityTodoStore.getState().save(priorityTodo);
  },
  saveMany: (priorityTodos: PriorityTodo[]) => {
    usePriorityTodoStore.getState().saveMany(priorityTodos);
  },
  delete: (args: { id: string }) => {
    usePriorityTodoStore.getState().deletePriorityTodo(args);
  },
});
