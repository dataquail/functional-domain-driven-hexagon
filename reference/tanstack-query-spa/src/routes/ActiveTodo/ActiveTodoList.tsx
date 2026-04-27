import { ActiveTodoCard } from './ActiveTodoCard';
import { activeTodoService } from 'src/core/infrastructure/services/ActiveTodoService';
import { usePriorityTodoStore } from 'src/core/infrastructure/repositories/PriorityTodoRepository/priorityTodoStore';
import { useMemo } from 'react';

export const ActiveTodoList = () => {
  const { data, isPending } = activeTodoService.getAll.useHook();
  const priorityDict = usePriorityTodoStore((state) => state.dict);

  const sortedData = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const aPrioritized = priorityDict[a.id]?.isPrioritized ?? false;
      const bPrioritized = priorityDict[b.id]?.isPrioritized ?? false;
      if (aPrioritized && !bPrioritized) return -1;
      if (!aPrioritized && bPrioritized) return 1;
      return 0;
    });
  }, [data, priorityDict]);

  if (isPending || !data) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  return (
    <div className="scroll-area">
      {sortedData.map((todo) => (
        <ActiveTodoCard key={todo.id} todo={todo} />
      ))}
    </div>
  );
};
