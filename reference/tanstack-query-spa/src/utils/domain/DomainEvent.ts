export abstract class DomainEvent<TPayload extends object> {
  constructor(
    public readonly name: string,
    public readonly payload: TPayload,
  ) {}
}
