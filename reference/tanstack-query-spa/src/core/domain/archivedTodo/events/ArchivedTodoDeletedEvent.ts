import { DomainEvent } from 'src/utils/domain/DomainEvent';

export class ArchivedTodoDeletedEvent extends DomainEvent<{ id: string }> {
  constructor(payload: { id: string }) {
    super('ArchivedTodoDeletedEvent', payload);
  }
}
