import {
  DefineChimericInfiniteQuery,
  DefineChimericMutation,
} from '@chimeric/react-query';
import { ArchivedTodoPageDto } from 'src/core/domain/archivedTodo/dtos/out/ArchivedTodoPageDto';
import { ArchiveBody } from 'src/core/domain/archivedTodo/dtos/in/ArchiveBody';

export type IArchivedTodoService = {
  getAll: DefineChimericInfiniteQuery<
    () => Promise<{
      pages: ArchivedTodoPageDto[];
      pageParams: number[];
    }>,
    ArchivedTodoPageDto,
    number,
    Error,
    string[]
  >;
  archiveCompleted: DefineChimericMutation<
    (body: ArchiveBody) => Promise<{ ids: string[] }>,
    Error
  >;
  unarchiveOne: DefineChimericMutation<
    (args: { id: string }) => Promise<{ id: string }>,
    Error
  >;
  deleteOne: DefineChimericMutation<
    (args: { id: string }) => Promise<void>,
    Error
  >;
};
