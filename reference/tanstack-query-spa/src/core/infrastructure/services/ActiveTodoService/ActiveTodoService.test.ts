import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { mockGetAllActiveTodos } from 'src/__test__/network/activeTodo/mockGetAllActiveTodos';
import { mockCreateOneActiveTodo } from 'src/__test__/network/activeTodo/mockCreateOneActiveTodo';
import { mockDeleteOneActiveTodo } from 'src/__test__/network/activeTodo/mockDeleteOneActiveTodo';
import { mockCompleteOneActiveTodo } from 'src/__test__/network/activeTodo/mockCompleteOneActiveTodo';
import { mockUncompleteOneActiveTodo } from 'src/__test__/network/activeTodo/mockUncompleteOneActiveTodo';
import { mockGetOneActiveTodo } from 'src/__test__/network/activeTodo/mockGetOneActiveTodo';
import { activeTodoService } from '.';
import { priorityTodoRepository } from 'src/core/infrastructure/repositories/PriorityTodoRepository';
import { prioritizeTodoUseCase } from 'src/core/useCases/activeTodo/application/prioritizeTodoUseCase';
import { deprioritizeTodoUseCase } from 'src/core/useCases/activeTodo/application/deprioritizeTodoUseCase';
import { usePriorityTodoStore } from 'src/core/infrastructure/repositories/PriorityTodoRepository/priorityTodoStore';

describe('ActiveTodoService', () => {
  const server = setupServer();

  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    usePriorityTodoStore.setState({ dict: {} });
  });
  afterAll(() => server.close());

  const nowTimeStamp = new Date().toISOString();

  const withOneUncompletedActiveTodoInList = () => {
    mockGetAllActiveTodos(server, {
      total_count: 1,
      list: [
        {
          id: '1',
          title: 'Active Todo 1',
          created_at: nowTimeStamp,
          completed_at: null,
        },
      ],
    });
  };

  const withOneUncompletedActiveTodo = () => {
    mockGetOneActiveTodo(server, {
      id: '1',
      title: 'Active Todo 1',
      created_at: nowTimeStamp,
      completed_at: null,
    });
  };

  const withOneCompletedActiveTodoInList = () => {
    mockGetAllActiveTodos(server, {
      total_count: 1,
      list: [
        {
          id: '1',
          title: 'Active Todo 1',
          created_at: nowTimeStamp,
          completed_at: nowTimeStamp,
        },
      ],
    });
  };

  const withNoActiveTodosInList = () => {
    mockGetAllActiveTodos(server, {
      total_count: 0,
      list: [],
    });
  };

  const withSuccessfullyCreatedActiveTodo = () =>
    mockCreateOneActiveTodo(server, {
      id: '1',
    });

  const withSuccessfullyDeletedActiveTodo = () =>
    mockDeleteOneActiveTodo(server, { message: 'success' });

  const withSuccessfullyCompletedActiveTodo = () =>
    mockCompleteOneActiveTodo(server, { message: 'success' });

  const withSuccessfullyUncompletedActiveTodo = () =>
    mockUncompleteOneActiveTodo(server, { message: 'success' });

  it('getAll', async () => {
    withOneUncompletedActiveTodoInList();
    const allActiveTodos = await activeTodoService.getAll();
    expect(allActiveTodos.length).toBe(1);
    expect(allActiveTodos[0].id).toBe('1');
    expect(allActiveTodos[0].title).toBe('Active Todo 1');
    expect(allActiveTodos[0].createdAt.toISOString()).toBe(nowTimeStamp);
    expect(allActiveTodos[0].completedAt).toBeUndefined();
  });

  it('getOneById', async () => {
    withOneUncompletedActiveTodo();
    const activeTodo = await activeTodoService.getOneById({
      id: '1',
    });
    expect(activeTodo?.id).toBe('1');
    expect(activeTodo?.title).toBe('Active Todo 1');
  });

  it('createOne', async () => {
    withNoActiveTodosInList();
    expect((await activeTodoService.getAll()).length).toBe(0);
    withSuccessfullyCreatedActiveTodo();
    const createActiveTodoResponse = await activeTodoService.createOne({
      title: 'Active Todo 1',
    });
    expect(createActiveTodoResponse.id).toBe('1');
    withOneUncompletedActiveTodoInList();
    expect((await activeTodoService.getAll()).length).toBe(1);
  });

  it('deleteOne', async () => {
    withOneUncompletedActiveTodoInList();
    expect((await activeTodoService.getAll()).length).toBe(1);
    withSuccessfullyDeletedActiveTodo();
    withNoActiveTodosInList();
    await activeTodoService.deleteOne({ id: '1' });
    expect((await activeTodoService.getAll()).length).toBe(0);
  });

  it('completeOne', async () => {
    withOneUncompletedActiveTodoInList();
    expect((await activeTodoService.getAll()).length).toBe(1);
    withSuccessfullyCompletedActiveTodo();
    withOneCompletedActiveTodoInList();
    await activeTodoService.completeOne({ id: '1' });
    expect((await activeTodoService.getAll()).length).toBe(1);
    expect(
      (await activeTodoService.getAll())[0].completedAt?.toISOString(),
    ).toBe(nowTimeStamp);
  });

  it('uncompleteOne', async () => {
    withOneCompletedActiveTodoInList();
    expect((await activeTodoService.getAll()).length).toBe(1);
    withSuccessfullyUncompletedActiveTodo();
    await activeTodoService.uncompleteOne({ id: '1' });
    withOneUncompletedActiveTodoInList();
    expect((await activeTodoService.getAll()).length).toBe(1);
    expect((await activeTodoService.getAll())[0].completedAt).toBeUndefined();
  });

  it('prioritize', async () => {
    withOneUncompletedActiveTodoInList();
    await activeTodoService.getAll();

    const priorityTodo = priorityTodoRepository.getOneById({ id: '1' });
    expect(priorityTodo?.isPrioritized).toBe(false);

    prioritizeTodoUseCase({ id: '1' });
    const priorityTodoAfter = priorityTodoRepository.getOneById({ id: '1' });
    expect(priorityTodoAfter?.isPrioritized).toBe(true);
  });

  it('deprioritize', async () => {
    withOneUncompletedActiveTodoInList();
    await activeTodoService.getAll();

    expect(
      priorityTodoRepository.getOneById({ id: '1' })?.isPrioritized,
    ).toBe(false);

    prioritizeTodoUseCase({ id: '1' });
    expect(
      priorityTodoRepository.getOneById({ id: '1' })?.isPrioritized,
    ).toBe(true);

    deprioritizeTodoUseCase({ id: '1' });
    expect(
      priorityTodoRepository.getOneById({ id: '1' })?.isPrioritized,
    ).toBe(false);
  });
});
