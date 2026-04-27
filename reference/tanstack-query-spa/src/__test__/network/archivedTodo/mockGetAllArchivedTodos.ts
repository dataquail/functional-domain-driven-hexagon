import { SetupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getConfig } from 'src/utils/getConfig';
import { ArchivedTodoPageDto } from 'src/core/domain/archivedTodo/dtos/out/ArchivedTodoPageDto';

export const mockGetAllArchivedTodos = (
  server: SetupServer,
  archivedTodoPageDto: ArchivedTodoPageDto,
) => {
  server.use(
    http.get(`${getConfig().API_URL}/archived-todo`, () => {
      return HttpResponse.json(archivedTodoPageDto);
    }),
  );
};
