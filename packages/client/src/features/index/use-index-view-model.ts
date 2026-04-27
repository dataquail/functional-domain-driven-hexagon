import { useRuntime } from "@/services/runtime/use-runtime";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";
import * as React from "react";
import {
  type IndexViewModel,
  type IndexViewState,
  initialIndexViewState,
  make,
} from "./index.view-model";

export const useIndexViewModel = () => {
  const runtime = useRuntime();
  const [state, setState] = React.useState<IndexViewState>(initialIndexViewState);
  const vmRef = React.useRef<IndexViewModel | null>(null);

  React.useEffect(() => {
    const fiber = runtime.runFork(
      Effect.gen(function* () {
        const vm = yield* make;
        vmRef.current = vm;
        yield* vm.state.changes.pipe(
          Stream.tap((next) =>
            Effect.sync(() => {
              setState(next);
            }),
          ),
          Stream.runDrain,
        );
      }).pipe(Effect.scoped),
    );

    return () => {
      vmRef.current = null;
      runtime.runFork(Fiber.interrupt(fiber));
    };
  }, [runtime]);

  const filterLargeData = React.useCallback(() => {
    const vm = vmRef.current;
    if (vm !== null) runtime.runFork(vm.filterLargeData);
  }, [runtime]);

  const calculatePrimes = React.useCallback(() => {
    const vm = vmRef.current;
    if (vm !== null) runtime.runFork(vm.calculatePrimes);
  }, [runtime]);

  return {
    state,
    filterLargeData,
    calculatePrimes,
  };
};
