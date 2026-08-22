"use client";

// The one component that holds the Next router.
//
// Inbound: the current pathname is mirrored into the graph on every navigation,
// so a ViewModel derives from it the way it derives from anything else.
// Outbound: a navigation request written by a ViewModel is pushed to the router.

import { useAtomSet, useAtomSubscribe } from "@effect/atom-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { type NavigationRequest, navigationRequestAtom, pathnameAtom } from "./navigation.shared";

export const NavigationBridge: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const setPathname = useAtomSet(pathnameAtom);

  React.useEffect(() => {
    setPathname(pathname);
  }, [pathname, setPathname]);

  useAtomSubscribe(navigationRequestAtom, (request: NavigationRequest | null) => {
    if (request === null) return;
    router.push(request.href);
  });

  return null;
};
