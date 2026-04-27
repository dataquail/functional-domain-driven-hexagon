type Listener = (event: unknown) => void;

export class ApplicationEventEmitter {
  private readonly events: Set<unknown>;
  private readonly listeners: Set<Listener>;

  constructor() {
    this.events = new Set();
    this.listeners = new Set();
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);

    this.events.forEach((event) => {
      listener(event);
      this.events.delete(event);
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  public emit(event: unknown) {
    this.events.add(event);

    if (this.listeners.size > 0) {
      this.listeners.forEach((listener) => {
        listener(event);
      });
      this.events.delete(event);
    }
  }

  public clearEvents() {
    this.events.clear();
  }

  public clearListeners() {
    this.listeners.clear();
  }

  public getEvents() {
    return Array.from(this.events);
  }
}
