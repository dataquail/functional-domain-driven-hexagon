import { Review } from 'src/core/domain/review/entities/Review';
import { create } from 'zustand';

export type ReviewRecord = {
  createdAt: string;
  todoIdList: string[];
};

export type ReviewStore = {
  record: ReviewRecord | undefined;
  save: (review: Review) => void;
  delete: () => void;
};

const toRecord = (review: Review): ReviewRecord => ({
  createdAt: review.createdAt.toISOString(),
  todoIdList: review.todoIdList,
});

export const useReviewStore = create<ReviewStore>((set) => ({
  record: undefined,
  save: (review: Review) => set({ record: toRecord(review) }),
  delete: () => set({ record: undefined }),
}));
