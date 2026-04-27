import { SetupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getConfig } from 'src/utils/getConfig';
import { IGetAllActiveTodos } from 'src/core/infrastructure/services/ActiveTodoService/methods/getAll';

export const mockGetAllActiveTodos = (
  server: SetupServer,
  activeTodoListDto: Awaited<ReturnType<IGetAllActiveTodos>>,
) => {
  server.use(
    http.get(`${getConfig().API_URL}/active-todo`, () => {
      return HttpResponse.json(activeTodoListDto);
    }),
  );
};
