import { type LiveManagedRuntime } from "@/services/live-layer";
import React from "react";

export const RuntimeContext = React.createContext<LiveManagedRuntime | null>(null);
