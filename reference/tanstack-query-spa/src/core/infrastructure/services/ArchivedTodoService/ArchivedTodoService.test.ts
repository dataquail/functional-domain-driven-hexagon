import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { archivedTodoService } from 'src/core/infrastructure/services/ArchivedTodoService';
import { mockGetAllArchivedTodos } from 'src/__test__/network/archivedTodo/mockGetAllArchivedTodos';
import { mockArchiveCompletedTodos } from 'src/__test__/network/archivedTodo/mockArchiveCompletedTodos';
import { mockUnarchiveArchivedTodo } from 'src/__test__/network/archivedTodo/mockUnarchiveArchivedTodo';
import { mockDeleteArchivedTodo } from 'src/__test__/network/archivedTodo/mockDeleteArchivedTodo';

describe('ArchivedTodoService', () => {
  const server = setupServer();

  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  const nowTimeStamp = new Date().toISOString();

  const withOneArchivedTodoPage = () => {
    mockGetAllArchivedTodos(server, {
      list: [
        {
          id: '1',
          title: 'Archived Todo 1',
          completed_at: nowTimeStamp,
          archived_at: nowTimeStamp,
        },
      ],
      next_cursor: null,
    });
  };

  const withEmptyArchivedTodoPage = () => {
    mockGetAllArchivedTodos(server, {
      list: [],
      next_cursor: null,
    });
  };

  it('getAll returns paginated archived todos', async () => {
    withOneArchivedTodoPage();
    const result = await archivedTodoService.getAll();
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].list).toHaveLength(1);
    expect(result.pages[0].list[0].id).toBe('1');
    expect(result.pages[0].list[0].title).toBe('Archived Todo 1');
  });

  it('archiveCompleted', async () => {
    mockArchiveCompletedTodos(server, { ids: ['archived-1', 'archived-2'] });
    withOneArchivedTodoPage();
    const result = await archivedTodoService.archiveCompleted({
      activeTodoIds: ['1', '2'],
    });
    expect(result.ids).toEqual(['archived-1', 'archived-2']);
  });

  it('unarchiveOne', async () => {
    withOneArchivedTodoPage();
    expect((await archivedTodoService.getAll()).pages[0].list).toHaveLength(1);
    mockUnarchiveArchivedTodo(server, { id: 'active-1' });
    const result = await archivedTodoService.unarchiveOne({ id: '1' });
    expect(result.id).toBe('active-1');
  });

  it('deleteOne', async () => {
    withOneArchivedTodoPage();
    expect((await archivedTodoService.getAll()).pages[0].list).toHaveLength(1);
    mockDeleteArchivedTodo(server, { message: 'success' });
    withEmptyArchivedTodoPage();
    await archivedTodoService.deleteOne({ id: '1' });
    expect((await archivedTodoService.getAll()).pages[0].list).toHaveLength(0);
  });
});
