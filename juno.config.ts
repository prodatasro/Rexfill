import { defineConfig } from "@junobuild/config";

export default defineConfig({
  satellite: {
    ids: {
      // Add your satellite IDs here
      development: "uqqxf-5h777-77774-qaaaa-cai",
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
