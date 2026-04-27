import { ArchivedTodoDto } from './ArchivedTodoDto';

export type ArchivedTodoPageDto = {
  list: ArchivedTodoDto[];
  next_cursor: number | null;
};
