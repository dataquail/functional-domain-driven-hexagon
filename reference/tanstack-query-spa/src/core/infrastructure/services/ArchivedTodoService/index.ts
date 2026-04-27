import { GetAllMethodImpl } from './methods/getAll';
import { ArchiveCompletedMethodImpl } from './methods/archiveCompleted';
import { UnarchiveOneMethodImpl } from './methods/unarchiveOne';
import { DeleteOneMethodImpl } from './methods/deleteOne';
import { IArchivedTodoService } from 'src/core/domain/archivedTodo/ports/IArchivedTodoService';

export const archivedTodoService: IArchivedTodoService = {
  getAll: GetAllMethodImpl,
  archiveCompleted: ArchiveCompletedMethodImpl,
  unarchiveOne: UnarchiveOneMethodImpl,
  deleteOne: DeleteOneMethodImpl,
};
