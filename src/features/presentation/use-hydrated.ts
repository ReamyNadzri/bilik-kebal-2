"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * True once the component is running in the browser.
 *
 * These forms do their work in the client, so before hydration a submit click
 * would fall through to a native form submission and lose the entered values.
 * Marking the form lets a test wait for interactivity deterministically, and
 * gives later slices a hook for disabling submission until it is ready.
 *
 * useSyncExternalStore rather than setState in an effect: it is the supported
 * way to return a different value on server and client, and it avoids the
 * cascading render that react-hooks/set-state-in-effect warns about.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
