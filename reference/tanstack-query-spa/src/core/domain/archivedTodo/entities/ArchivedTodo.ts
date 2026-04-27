import { ArchivedTodoDto } from 'src/core/domain/archivedTodo/dtos/out/ArchivedTodoDto';

export type ArchivedTodo = {
  id: string;
  title: string;
  completedAt: Date;
  archivedAt: Date;
};

export const mapArchivedTodoDtoToArchivedTodo = (
  archivedTodoDto: ArchivedTodoDto,
): ArchivedTodo => ({
  id: archivedTodoDto.id,
  title: archivedTodoDto.title,
  completedAt: new Date(archivedTodoDto.completed_at),
  archivedAt: new Date(archivedTodoDto.archived_at),
});
