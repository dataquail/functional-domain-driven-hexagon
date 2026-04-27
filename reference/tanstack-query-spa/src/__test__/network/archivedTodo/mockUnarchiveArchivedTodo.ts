import { SetupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getConfig } from 'src/utils/getConfig';

export const mockUnarchiveArchivedTodo = (
  server: SetupServer,
  response: { id: string },
) => {
  server.use(
    http.post(`${getConfig().API_URL}/archived-todo/:id/unarchive`, () => {
      return HttpResponse.json(response);
    }),
  );
};
