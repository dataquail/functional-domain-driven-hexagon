import { SetupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getConfig } from 'src/utils/getConfig';

export const mockDeleteArchivedTodo = (
  server: SetupServer,
  response: { message: string },
) => {
  server.use(
    http.delete(`${getConfig().API_URL}/archived-todo/:id`, () => {
      return HttpResponse.json(response);
    }),
  );
};
