export type Review = {
  createdAt: Date;
  todoIdList: string[];
};

export const createReview = (todoIdList: string[]): Review => {
  // validate that the todoIdList doesn't contain duplicates
  if (new Set(todoIdList).size !== todoIdList.length) {
    throw new Error('todoIdList contains duplicates');
  }
  return {
    createdAt: new Date(),
    todoIdList,
  };
};
