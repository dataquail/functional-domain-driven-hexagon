import { ChimericMutationFactory } from '@chimeric/react-query';
import { getInfiniteQueryOptionsGetAll } from './getAll';
import { getConfig } from 'src/utils/getConfig';
import { wrappedFetch } from 'src/utils/network/wrappedFetch';
import { queryClient } from 'src/core/global/queryClient';
import { IArchivedTodoService } from 'src/core/domain/archivedTodo/ports/IArchivedTodoService';
import { getQueryOptionsGetAll as getQueryOptionsGetAllActiveTodos } from 'src/core/infrastructure/services/ActiveTodoService/methods/getAll';

export const UnarchiveOneMethodImpl: IArchivedTodoService['unarchiveOne'] =
  ChimericMutationFactory({
    queryClient,
    mutationFn: async (args: { id: string }) => {
      return wrappedFetch<{ id: string }>(
        `${getConfig().API_URL}/archived-todo/${args.id}/unarchive`,
        {
          method: 'post',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getInfiniteQueryOptionsGetAll().queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: getQueryOptionsGetAllActiveTodos().queryKey,
      });
    },
  });
