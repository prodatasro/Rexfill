import { defineConfig } from "@junobuild/config";

export default defineConfig({
  satellite: {
    ids: {
      // Add your satellite IDs here
      development: "auamu-4x777-77775-aaaaa-cai",
      production: "ufqml-byaaa-aaaas-amtia-cai"
    },
    source: "dist",
    collections: {
      datastore: [
        { collection: 'templates_meta', read: 'private', write: 'private', memory: 'stable' },
        { collection: 'folders', read: 'private', write: 'private', memory: 'stable' }
      ],
      storage: [
        { collection: 'templates', read: 'private', write: 'private', memory: 'stable'}
      ]
    },
  }
});
