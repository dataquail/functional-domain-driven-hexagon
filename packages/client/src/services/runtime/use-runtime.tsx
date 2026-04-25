import { type LiveManagedRuntime } from "@/services/live-layer";
import React from "react";
import { RuntimeContext } from "./runtime-context";

export const useRuntime = (): LiveManagedRuntime => {
  const runtime = React.useContext(RuntimeContext);
  if (runtime === null) throw new Error("useRuntime must be used within a RuntimeProvider");
  return runtime;
};
