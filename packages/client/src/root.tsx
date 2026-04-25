import React from "react";
import { createRoot } from "react-dom/client";
import { GlobalProviders } from "./global-providers.tsx";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalProviders />
  </React.StrictMode>,
);
