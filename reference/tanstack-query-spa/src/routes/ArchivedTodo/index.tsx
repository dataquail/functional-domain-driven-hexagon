import { AppShellWrapper } from 'src/components/AppShellWrapper';
import { ArchivedTodoList } from './ArchivedTodoList';

export const ArchivedTodo = () => {
  return (
    <AppShellWrapper>
      <div className="page-header">
        <h1>Archived Todo List</h1>
      </div>
      <div className="spacer-lg" />
      <ArchivedTodoList />
    </AppShellWrapper>
  );
};
