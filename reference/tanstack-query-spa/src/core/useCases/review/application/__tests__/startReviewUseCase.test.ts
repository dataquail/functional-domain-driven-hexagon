import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { mockGetAllActiveTodos } from 'src/__test__/network/activeTodo/mockGetAllActiveTodos';
import { startReviewUseCase } from '../startReviewUseCase';
import { reviewRepository } from 'src/core/infrastructure/repositories/ReviewRepository';

describe('startReviewUseCase', () => {
  const server = setupServer();

  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  const nowTimeStamp = new Date().toISOString();

  const withOneUncompletedAndOneCompletedActiveTodoInList = () => {
    mockGetAllActiveTodos(server, {
      total_count: 2,
      list: [
        {
          id: '1',
          title: 'Active Todo 1',
          created_at: nowTimeStamp,
          completed_at: null,
        },
        {
          id: '2',
          title: 'Active Todo 2',
          created_at: nowTimeStamp,
          completed_at: nowTimeStamp,
        },
      ],
    });
  };

  it('startReview gathers only completed active todos', async () => {
    withOneUncompletedAndOneCompletedActiveTodoInList();

    await startReviewUseCase();

    const review = reviewRepository.get();
    // only includes completed activeTodo 2
    expect(review?.todoIdList).toEqual(['2']);
  });
});
