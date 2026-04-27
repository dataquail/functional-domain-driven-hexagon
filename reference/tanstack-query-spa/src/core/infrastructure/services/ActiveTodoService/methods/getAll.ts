import { queryOptions } from '@tanstack/react-query';
import {
  ActiveTodo,
  mapTodoDtoToActiveTodo,
} from 'src/core/domain/activeTodo/entities/ActiveTodo';
import { ChimericQueryFactory } from '@chimeric/react-query';
import { ActiveTodosFetchedEvent } from 'src/core/domain/activeTodo/events/ActiveTodosFetchedEvent';
import { getConfig } from 'src/utils/getConfig';
import { TodoListDto } from 'src/core/domain/activeTodo/dtos/out/TodoListDto';
import { wrappedFetch } from 'src/utils/network/wrappedFetch';
import { queryClient } from 'src/core/global/queryClient';
import { applicationEventEmitter } from 'src/core/global/applicationEventEmitter';
import { IActiveTodoService } from 'src/core/domain/activeTodo/ports/IActiveTodoService';

export type IGetAllActiveTodos = () => Promise<TodoListDto>;

export const getTodoList: IGetAllActiveTodos = async () => {
  return wrappedFetch<TodoListDto>(`${getConfig().API_URL}/active-todo`);
};

export const GET_ALL_QUERY_KEY = ['GET_TODO_LIST'] as const;

export const getQueryOptionsGetAll = () =>
  queryOptions({
    queryKey: [...GET_ALL_QUERY_KEY],
    queryFn: async (): Promise<ActiveTodo[]> => {
      const todoListDto = await getTodoList();
      const activeTodos = todoListDto.list.map(mapTodoDtoToActiveTodo);
      applicationEventEmitter.emit(
        new ActiveTodosFetchedEvent({
          ids: activeTodos.map((todo) => todo.id),
        }),
      );
      return activeTodos;
    },
  });

export const GetAllMethodImpl: IActiveTodoService['getAll'] =
  ChimericQueryFactory({
    queryClient,
    getQueryOptions: getQueryOptionsGetAll,
  });
