import { AppShellWrapper } from 'src/components/AppShellWrapper';
import { ActiveTodoList } from './ActiveTodoList';
import { AddNewActiveTodoForm } from './AddNewActiveTodoForm';

export const ActiveTodo = () => {
  return (
    <AppShellWrapper>
      <div className="page-header">
        <h1>Active Todo List</h1>
        <AddNewActiveTodoForm />
      </div>
      <div className="spacer-lg" />
      <ActiveTodoList />
    </AppShellWrapper>
  );
};
