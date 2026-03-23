import { createContext, useContext } from "react";
import type { EventBus } from "./createEventBus";

export const EventBusContext = createContext<EventBus | null>(null);

export function useEventBus() {
  const bus = useContext(EventBusContext);

  if (!bus) {
    throw new Error("EventBusContext is missing");
  }

  return bus;
}
