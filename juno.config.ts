import { defineConfig } from "@junobuild/config";

export default defineConfig({
  satellite: {
    ids: {
      // Add your satellite IDs here
      development: "atbka-rp777-77775-aaaaq-cai",
      production: "your-prod-satellite-id"
    },
    source: "dist",
  }
});
