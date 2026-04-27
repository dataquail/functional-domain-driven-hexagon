import { describe, it, expect } from 'vitest';
import { createReview } from 'src/core/domain/review/entities/Review';
import { reviewRepository } from '.';

describe('reviewRepository', () => {
  it('get', () => {
    const review = reviewRepository.get();
    expect(review).toBeUndefined();
  });

  it('save', () => {
    reviewRepository.save(createReview(['1', '2', '3']));
    const review = reviewRepository.get();
    expect(review).toBeDefined();
    expect(review?.todoIdList).toEqual(['1', '2', '3']);
  });

  it('delete', () => {
    reviewRepository.save(createReview(['1', '2', '3']));
    const review = reviewRepository.get();
    expect(review).toBeDefined();
    expect(review?.todoIdList).toEqual(['1', '2', '3']);

    reviewRepository.delete();
    const deletedReview = reviewRepository.get();
    expect(deletedReview).toBeUndefined();
  });
});
