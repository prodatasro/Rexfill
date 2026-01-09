import { defineConfig } from "@junobuild/config";

export default defineConfig({
  satellite: {
    ids: {
      // Add your satellite IDs here
      development: "a5dhi-k7777-77775-aaabq-cai",
      production: "ufqml-byaaa-aaaas-amtia-cai"
    },
    source: "dist",
    collections: {
      datastore: [
        { collection: 'templates_meta', read: 'managed', write: 'managed', memory: 'stable' },
        { collection: 'folders', read: 'managed', write: 'managed', memory: 'stable' }
      ],
      storage: [
        { collection: 'templates', read: 'managed', write: 'managed', memory: 'stable'}
      ]
    },
  }
});
