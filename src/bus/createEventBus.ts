import type {
  EventHandler,
  PhaserCommandMap,
  PhaserEventMap,
} from "./types";

type Registry<TMap extends Record<string, unknown>> = {
  [K in keyof TMap]?: Set<EventHandler<TMap[K]>>;
};

function createChannel<TMap extends Record<string, unknown>>() {
  const registry: Registry<TMap> = {};

  return {
    emit<K extends keyof TMap>(type: K, payload: TMap[K]) {
      const handlers = registry[type];

      if (!handlers) {
        return;
      }

      handlers.forEach((handler) => {
        handler(payload);
      });
    },
    subscribe<K extends keyof TMap>(type: K, handler: EventHandler<TMap[K]>) {
      const handlers = registry[type] ?? new Set<EventHandler<TMap[K]>>();
      handlers.add(handler);
      registry[type] = handlers;

      return () => {
        handlers.delete(handler);

        if (handlers.size === 0) {
          delete registry[type];
        }
      };
    },
  };
}

export function createEventBus() {
  const commands = createChannel<PhaserCommandMap>();
  const events = createChannel<PhaserEventMap>();

  return {
    commands,
    events,
  };
}

export type EventBus = ReturnType<typeof createEventBus>;
