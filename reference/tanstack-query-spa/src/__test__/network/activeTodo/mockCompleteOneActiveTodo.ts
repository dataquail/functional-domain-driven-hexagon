import { SetupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getConfig } from 'src/utils/getConfig';
import { ICompleteActiveTodo } from 'src/core/infrastructure/services/ActiveTodoService/methods/complete';

export const mockCompleteOneActiveTodo = (
  server: SetupServer,
  completeActiveTodoResponse: Awaited<ReturnType<ICompleteActiveTodo>>,
) => {
  server.use(
    http.post(`${getConfig().API_URL}/active-todo/:id/complete`, () => {
      return HttpResponse.json(completeActiveTodoResponse);
    }),
  );
};
