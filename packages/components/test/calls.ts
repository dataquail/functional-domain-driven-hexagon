// A callback prop that remembers each call's arguments, in order.
export const recordCalls = <Args extends ReadonlyArray<unknown> = []>() => {
  const calls: Array<Args> = [];

  const callback = (...args: Args): void => {
    calls.push(args);
  };

  return { callback, calls };
};
