import {
  DefineChimericMutation,
  DefineChimericQuery,
} from '@chimeric/react-query';
import { CreateTodoBody } from '../dtos/in/CreateTodoBody';
import { ActiveTodo } from '../entities/ActiveTodo';

export type IActiveTodoService = {
  getAll: DefineChimericQuery<() => Promise<ActiveTodo[]>, Error, string[]>;
  getOneById: DefineChimericQuery<
    (args: { id: string }) => Promise<ActiveTodo>,
    Error,
    string[]
  >;
  createOne: DefineChimericMutation<
    (body: CreateTodoBody) => Promise<{ id: string }>,
    Error
  >;
  deleteOne: DefineChimericMutation<
    (args: { id: string }) => Promise<void>,
    Error
  >;
  completeOne: DefineChimericMutation<
    (args: { id: string }) => Promise<void>,
    Error
  >;
  uncompleteOne: DefineChimericMutation<
    (args: { id: string }) => Promise<{ id: string }>,
    Error
  >;
};
