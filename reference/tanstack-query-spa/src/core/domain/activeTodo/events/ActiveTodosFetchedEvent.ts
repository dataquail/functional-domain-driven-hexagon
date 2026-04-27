import { DomainEvent } from 'src/utils/domain/DomainEvent';

export class ActiveTodosFetchedEvent extends DomainEvent<{
  ids: string[];
}> {
  constructor(payload: { ids: string[] }) {
    super('ActiveTodosFetchedEvent', payload);
  }
}
