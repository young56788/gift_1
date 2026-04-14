import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Phaser runtime is expected to be large and is already isolated from the app entry chunk.
    chunkSizeWarningLimit: 1300,
    modulePreload: {
      resolveDependencies(_, deps) {
        return deps.filter((dep) => !dep.includes("phaser-"));
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }

          if (id.includes("/node_modules/phaser/")) {
            return "phaser-runtime";
          }

          if (id.includes("/src/modules/map/scenes/MapScene.ts")) {
            return "phaser-map-scene";
          }

          if (id.includes("/src/modules/shrimp/scenes/ShrimpScene.ts")) {
            return "phaser-shrimp-scene";
          }

          if (id.includes("/src/modules/catan/scenes/CatanGameScene.ts")) {
            return "phaser-catan-scene";
          }

          if (id.includes("/src/modules/map/config/content.ts")) {
            return "map-content";
          }

          if (id.includes("/src/modules/shrimp/config/content.ts")) {
            return "shrimp-content";
          }

          return undefined;
        },
      },
    },
  },
});
