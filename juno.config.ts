import { defineConfig } from "@junobuild/config";

export default defineConfig(({ mode }) => ({
  satellite: {
    ids: {
      // Add your satellite IDs here
      development: "auamu-4x777-77775-aaaaa-cai",
      production: "ufqml-byaaa-aaaas-amtia-cai"
    },
    source: "dist",
    storage: {
      headers: [
        {
          source: '/**',
          headers: [
            // max-age=63072000; - 2 years
            ['Strict-Transport-Security', 'max-age=300; includeSubDomains; preload']
          ]
        }
      ]
    },
    orbiter: {
      ids: {
        development: "a2cb4-hh777-77775-aaaba-cai",
        production: ""
      }
    },
    collections: {
      datastore: [
        { collection: 'templates_meta', read: 'private', write: 'private', memory: 'stable' },
        { collection: 'folders', read: 'private', write: 'private', memory: 'stable' },
        { collection: 'subscriptions', read: 'private', write: 'private', memory: 'stable' },
        { collection: 'usage', read: 'private', write: 'private', memory: 'stable' },
        { collection: 'contact_submissions', read: 'managed', write: 'public', memory: 'stable' },
        { collection: 'activity_logs', read: 'managed', write: 'private', memory: 'stable' },
      ],
      storage: [
        { collection: 'templates', read: 'private', write: 'private', memory: 'stable'}
      ]
    },
    authentication: {
      google: {
        clientId: mode === "development"
          ? "YOUR_DEVELOPMENT_CLIENT_ID.apps.googleusercontent.com"
          : "YOUR_PRODUCTION_CLIENT_ID.apps.googleusercontent.com"
      }
    }
  }
}));
