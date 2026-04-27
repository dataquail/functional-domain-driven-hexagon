import { queryOptions } from '@tanstack/react-query';
import {
  ActiveTodo,
  mapTodoDtoToActiveTodo,
} from 'src/core/domain/activeTodo/entities/ActiveTodo';
import { ChimericQueryFactory } from '@chimeric/react-query';
import { getConfig } from 'src/utils/getConfig';
import { wrappedFetch } from 'src/utils/network/wrappedFetch';
import { TodoDto } from 'src/core/domain/activeTodo/dtos/out/TodoDto';
import { queryClient } from 'src/core/global/queryClient';
import { IActiveTodoService } from 'src/core/domain/activeTodo/ports/IActiveTodoService';

export type IGetActiveTodo = (args: { id: string }) => Promise<TodoDto>;

export const getActiveTodo: IGetActiveTodo = async (args: { id: string }) => {
  return wrappedFetch<TodoDto>(`${getConfig().API_URL}/active-todo/${args.id}`);
};

export const getQueryOptionsGetOneById = (args: { id: string }) =>
  queryOptions({
    queryKey: ['GET_TODO', args.id],
    queryFn: async (): Promise<ActiveTodo> => {
      const activeTodoDto = await getActiveTodo(args);
      return mapTodoDtoToActiveTodo(activeTodoDto);
    },
  });

export const GetOneByIdMethodImpl: IActiveTodoService['getOneById'] =
  ChimericQueryFactory({
    queryClient,
    getQueryOptions: getQueryOptionsGetOneById,
  });
