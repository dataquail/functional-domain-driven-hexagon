import { SetupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getConfig } from 'src/utils/getConfig';
import { ICreateActiveTodo } from 'src/core/infrastructure/services/ActiveTodoService/methods/createOne';

export const mockCreateOneActiveTodo = (
  server: SetupServer,
  createActiveTodoResponse: Awaited<ReturnType<ICreateActiveTodo>>,
) => {
  server.use(
    http.post(`${getConfig().API_URL}/active-todo`, () => {
      return HttpResponse.json(createActiveTodoResponse);
    }),
  );
};
