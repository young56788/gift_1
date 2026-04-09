import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Phaser runtime is expected to be large and is already isolated from the app entry chunk.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/src/modules/map/scenes/")) {
            return "phaser-map-scene";
          }

          if (id.includes("/src/modules/shrimp/scenes/")) {
            return "phaser-shrimp-scene";
          }

          if (id.includes("/src/modules/catan/scenes/")) {
            return "phaser-catan-scene";
          }

          return undefined;
        },
      },
    },
  },
});
