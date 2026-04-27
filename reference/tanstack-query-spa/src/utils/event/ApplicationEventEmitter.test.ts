import { vi } from 'vitest';
import { ApplicationEventEmitter } from './ApplicationEventEmitter';

describe('ApplicationEventEmitter ', () => {
  it('should call the listener when an event is emitted', () => {
    const emitter = new ApplicationEventEmitter();
    const listener = vi.fn();

    emitter.subscribe(listener);
    emitter.emit('event');

    expect(listener).toHaveBeenCalledWith('event');
  });

  it('should queue events until a listener subscribes', () => {
    const emitter = new ApplicationEventEmitter();
    const listener = vi.fn();

    emitter.emit(1);
    emitter.emit(2);
    emitter.subscribe(listener);

    expect(listener.mock.calls[0][0]).toEqual(1);
    expect(listener.mock.calls[1][0]).toEqual(2);
    expect(emitter.getEvents()).toEqual([]);
  });

  it('should call all listeners when an event is emitted', () => {
    const emitter = new ApplicationEventEmitter();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.subscribe(listener1);
    emitter.subscribe(listener2);
    emitter.emit('event');

    expect(listener1).toHaveBeenCalledWith('event');
    expect(listener2).toHaveBeenCalledWith('event');
  });

  it('should remove a listener when unsubscribed', () => {
    const emitter = new ApplicationEventEmitter();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.subscribe(listener1);
    const unsubscribeListener2 = emitter.subscribe(listener2);
    unsubscribeListener2();
    emitter.emit('event');

    expect(listener1).toHaveBeenCalledWith('event');
    expect(listener2).not.toHaveBeenCalled();
  });

  it('should consume events when emitted to listeners', () => {
    const emitter = new ApplicationEventEmitter();
    const listener = vi.fn();

    emitter.emit(1);
    emitter.emit(2);

    expect(emitter.getEvents()).toEqual([1, 2]);

    emitter.subscribe(listener);

    expect(emitter.getEvents()).toEqual([]);
  });

  it('should clear all events', () => {
    const emitter = new ApplicationEventEmitter();
    const listener = vi.fn();

    emitter.emit(1);
    emitter.emit(2);
    emitter.clearEvents();

    emitter.subscribe(listener);

    expect(emitter.getEvents()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('should clear all listeners', () => {
    const emitter = new ApplicationEventEmitter();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.subscribe(listener1);
    emitter.subscribe(listener2);
    emitter.clearListeners();
    emitter.emit('event');

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });

  it('calls listener once', () => {
    const emitter = new ApplicationEventEmitter();
    const listener = vi.fn();

    emitter.subscribe(listener);

    emitter.emit('event');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('delete event after it has been emitted to a listenter', () => {
    const emitter = new ApplicationEventEmitter();
    const listener = vi.fn();

    emitter.subscribe(listener);
    emitter.emit(1);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(emitter.getEvents()).toEqual([]);
  });
});
