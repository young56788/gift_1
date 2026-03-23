import { useState, type PropsWithChildren } from "react";
import { EventBusContext } from "../../bus/EventBusContext";
import { createEventBus } from "../../bus/createEventBus";

export function EventBusProvider({ children }: PropsWithChildren) {
  const [bus] = useState(() => createEventBus());

  return (
    <EventBusContext.Provider value={bus}>
      {children}
    </EventBusContext.Provider>
  );
}
