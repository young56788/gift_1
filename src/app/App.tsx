import { AppShell } from "./components/AppShell";
import { EventBusProvider } from "./providers/EventBusProvider";
import { GameStoreProvider } from "./providers/GameStoreProvider";

export function App() {
  return (
    <GameStoreProvider>
      <EventBusProvider>
        <AppShell />
      </EventBusProvider>
    </GameStoreProvider>
  );
}
