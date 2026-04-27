import { ChimericMutationFactory } from '@chimeric/react-query';
import { getConfig } from 'src/utils/getConfig';
import { wrappedFetch } from 'src/utils/network/wrappedFetch';
import { getQueryOptionsGetAll } from './getAll';
import { getQueryOptionsGetOneById } from './getOneById';
import { queryClient } from 'src/core/global/queryClient';
import { IActiveTodoService } from 'src/core/domain/activeTodo/ports/IActiveTodoService';

export type IUncompleteActiveTodo = (args: {
  id: string;
}) => Promise<{ message: string }>;

export const uncompleteActiveTodo: IUncompleteActiveTodo = async (args: {
  id: string;
}) => {
  return wrappedFetch<{ message: string }>(
    `${getConfig().API_URL}/active-todo/${args.id}/uncomplete`,
    {
      method: 'post',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
  );
};

export const UncompleteOneMethodImpl: IActiveTodoService['uncompleteOne'] =
  ChimericMutationFactory({
    queryClient,
    mutationFn: async (args: { id: string }) => {
      await uncompleteActiveTodo(args);
      return args;
    },
    mutationKey: ['uncompleteOne'],
    onSuccess: async (_data, args) => {
      await queryClient.invalidateQueries({
        queryKey: getQueryOptionsGetAll().queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: getQueryOptionsGetOneById(args).queryKey,
      });
    },
  });
