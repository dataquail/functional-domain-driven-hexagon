import { DomainEvent } from 'src/utils/domain/DomainEvent';

export class ActiveTodoDeletedEvent extends DomainEvent<{ id: string }> {
  constructor(payload: { id: string }) {
    super('ActiveTodoDeletedEvent', payload);
  }
}
