import { TodoDto } from './TodoDto';

export type TodoListDto = {
  total_count: number;
  list: TodoDto[];
};
