import { SetupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getConfig } from 'src/utils/getConfig';
import { IGetActiveTodo } from 'src/core/infrastructure/services/ActiveTodoService/methods/getOneById';

export const mockGetOneActiveTodo = (
  server: SetupServer,
  activeTodoDto: Awaited<ReturnType<IGetActiveTodo>>,
) => {
  server.use(
    http.get(`${getConfig().API_URL}/active-todo/${activeTodoDto.id}`, () => {
      return HttpResponse.json(activeTodoDto);
    }),
  );
};
