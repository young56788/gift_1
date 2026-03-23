import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/phaser/")) {
            return "phaser-runtime";
          }

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
