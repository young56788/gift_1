type CreatePhaserGame = typeof import("./createPhaserGame").createPhaserGame;

let createPhaserGamePromise: Promise<CreatePhaserGame> | null = null;

export function loadCreatePhaserGame() {
  if (!createPhaserGamePromise) {
    createPhaserGamePromise = import("./createPhaserGame").then(
      ({ createPhaserGame }) => createPhaserGame,
    );
  }

  return createPhaserGamePromise;
}
