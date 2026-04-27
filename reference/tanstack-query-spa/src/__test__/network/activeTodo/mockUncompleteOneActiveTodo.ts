import { SetupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getConfig } from 'src/utils/getConfig';
import { IUncompleteActiveTodo } from 'src/core/infrastructure/services/ActiveTodoService/methods/uncomplete';

export const mockUncompleteOneActiveTodo = (
  server: SetupServer,
  uncompleteActiveTodoResponse: Awaited<ReturnType<IUncompleteActiveTodo>>,
) => {
  server.use(
    http.post(`${getConfig().API_URL}/active-todo/:id/uncomplete`, () => {
      return HttpResponse.json(uncompleteActiveTodoResponse);
    }),
  );
};
