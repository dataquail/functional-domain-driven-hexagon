import { Review } from 'src/core/domain/review/entities/Review';
import { ReviewRecord, ReviewStore, useReviewStore } from './reviewStore';
import { IReviewRepository } from 'src/core/domain/review/ports/IReviewRepository';
import { CreateChimericSyncFactory } from '@chimeric/react';

const ChimericSyncFactory = CreateChimericSyncFactory<ReviewStore>({
  getState: () => useReviewStore.getState(),
  useSelector: useReviewStore,
});

export const reviewRepository: IReviewRepository = {
  save: (review: Review) => {
    useReviewStore.getState().save(review);
  },
  delete: () => {
    useReviewStore.getState().delete();
  },
  get: ChimericSyncFactory({
    selector: () => (state) => state.record,
    reducer: (record) => (record ? toDomain(record) : undefined),
  }),
};

const toDomain = (record: ReviewRecord): Review => {
  return {
    createdAt: new Date(record.createdAt),
    todoIdList: record.todoIdList,
  };
};
