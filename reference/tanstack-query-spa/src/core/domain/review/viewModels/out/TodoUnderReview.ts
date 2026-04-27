export type TodoUnderReview = {
  id: string;
  title: string;
  createdAt: Date;
  completedAt: Date | undefined;
};
