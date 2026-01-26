import { defineConfig } from "@junobuild/config";

export default defineConfig(({ mode }) => ({
  satellite: {
    ids: {
      // Add your satellite IDs here
      development: "auamu-4x777-77775-aaaaa-cai",
      production: "ufqml-byaaa-aaaas-amtia-cai"
    },
    source: "dist",
    functions: [
      {
        name: "paddleWebhook",
        path: "/paddle-webhook"
      }
    ],
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

        { collection: 'subscriptions', read: 'managed', write: 'private', memory: 'stable' },
        { collection: 'usage', read: 'managed', write: 'private', memory: 'stable' },
        { collection: 'organizations', read: 'managed', write: 'private', memory: 'stable' },
        { collection: 'organization_members', read: 'managed', write: 'private', memory: 'stable' },
        { collection: 'organization_invitations', read: 'managed', write: 'private', memory: 'stable' },
        { collection: 'contact_submissions', read: 'managed', write: 'public', memory: 'stable' },
        { collection: 'activity_logs', read: 'managed', write: 'private', memory: 'stable' },
        { collection: 'user_profiles', read: 'managed', write: 'private', memory: 'stable' },
        { collection: 'notifications', read: 'managed', write: 'private', memory: 'stable' },
        // Admin collections
        { collection: 'platform_admins', read: 'public', write: 'managed', memory: 'stable' },
        { collection: 'admin_actions', read: 'managed', write: 'managed', memory: 'stable' },
        { collection: 'suspended_users', read: 'managed', write: 'managed', memory: 'stable' },
        { collection: 'subscription_overrides', read: 'managed', write: 'managed', memory: 'stable' },
        { collection: 'webhook_history', read: 'managed', write: 'managed', memory: 'stable' },
      ],
      storage: [
        { collection: 'templates', read: 'private', write: 'private', memory: 'stable'},
        { collection: 'user_avatars', read: 'private', write: 'private', memory: 'stable' }
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
