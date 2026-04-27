import { ChimericMutationFactory } from '@chimeric/react-query';
import { getInfiniteQueryOptionsGetAll } from './getAll';
import { getConfig } from 'src/utils/getConfig';
import { wrappedFetch } from 'src/utils/network/wrappedFetch';
import { queryClient } from 'src/core/global/queryClient';
import { IArchivedTodoService } from 'src/core/domain/archivedTodo/ports/IArchivedTodoService';
import { applicationEventEmitter } from 'src/core/global/applicationEventEmitter';
import { ArchivedTodoDeletedEvent } from 'src/core/domain/archivedTodo/events/ArchivedTodoDeletedEvent';

export const DeleteOneMethodImpl: IArchivedTodoService['deleteOne'] =
  ChimericMutationFactory({
    queryClient,
    mutationFn: async (args: { id: string }) => {
      await wrappedFetch<{ message: string }>(
        `${getConfig().API_URL}/archived-todo/${args.id}`,
        {
          method: 'delete',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );
    },
    onSuccess: async (_data, args) => {
      applicationEventEmitter.emit(
        new ArchivedTodoDeletedEvent({ id: args.id }),
      );
      await queryClient.invalidateQueries({
        queryKey: getInfiniteQueryOptionsGetAll().queryKey,
      });
    },
  });
