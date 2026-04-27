import { ChimericMutationFactory } from '@chimeric/react-query';
import { getConfig } from 'src/utils/getConfig';
import { wrappedFetch } from 'src/utils/network/wrappedFetch';
import { getQueryOptionsGetAll } from './getAll';
import { getQueryOptionsGetOneById } from './getOneById';
import { ActiveTodoDeletedEvent } from 'src/core/domain/activeTodo/events/ActiveTodoDeletedEvent';
import { queryClient } from 'src/core/global/queryClient';
import { applicationEventEmitter } from 'src/core/global/applicationEventEmitter';
import { IActiveTodoService } from 'src/core/domain/activeTodo/ports/IActiveTodoService';

export type IDeleteActiveTodo = (args: {
  id: string;
}) => Promise<{ message: string }>;

export const deleteActiveTodo: IDeleteActiveTodo = async (args: {
  id: string;
}) => {
  return wrappedFetch<{ message: string }>(
    `${getConfig().API_URL}/active-todo/${args.id}`,
    {
      method: 'delete',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
  );
};

export const DeleteOneMethodImpl: IActiveTodoService['deleteOne'] =
  ChimericMutationFactory({
    queryClient,
    mutationFn: async (args: { id: string }) => {
      await deleteActiveTodo(args);
    },
    onSuccess: async (_data, args) => {
      applicationEventEmitter.emit(new ActiveTodoDeletedEvent({ id: args.id }));
      await queryClient.invalidateQueries({
        queryKey: getQueryOptionsGetAll().queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: getQueryOptionsGetOneById(args).queryKey,
      });
    },
  });
