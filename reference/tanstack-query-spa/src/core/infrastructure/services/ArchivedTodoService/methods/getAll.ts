import { infiniteQueryOptions } from '@tanstack/react-query';
import { ChimericInfiniteQueryFactory } from '@chimeric/react-query';
import { getConfig } from 'src/utils/getConfig';
import { wrappedFetch } from 'src/utils/network/wrappedFetch';
import { ArchivedTodoPageDto } from 'src/core/domain/archivedTodo/dtos/out/ArchivedTodoPageDto';
import { queryClient } from 'src/core/global/queryClient';
import { IArchivedTodoService } from 'src/core/domain/archivedTodo/ports/IArchivedTodoService';

export const getArchivedTodoPage = async (args: { pageParam: number }) => {
  return wrappedFetch<ArchivedTodoPageDto>(
    `${getConfig().API_URL}/archived-todo?page=${args.pageParam}&limit=10`,
  );
};

export const getInfiniteQueryOptionsGetAll = () =>
  infiniteQueryOptions({
    queryKey: ['GET_ARCHIVED_TODO_LIST'],
    queryFn: ({ pageParam }) => getArchivedTodoPage({ pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });

export const GetAllMethodImpl: IArchivedTodoService['getAll'] =
  ChimericInfiniteQueryFactory({
    queryClient,
    getInfiniteQueryOptions: getInfiniteQueryOptionsGetAll,
  });
