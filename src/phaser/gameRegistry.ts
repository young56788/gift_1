import type Phaser from "phaser";

let instance: Phaser.Game | null = null;

export function setGameInstance(game: Phaser.Game | null) {
  instance = game;
}

export function getGameInstance() {
  return instance;
}
