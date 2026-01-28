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
        development: "atbka-rp777-77775-aaaaq-cai",
        production: ""
      }
    },
    collections: {
      datastore: [
        { collection: 'templates_meta', read: 'managed', write: 'private', memory: 'stable' },
        { collection: 'folders', read: 'private', write: 'private', memory: 'stable' },

        // Subscription and billing collections - RESTRICTED write (satellite-only via assertion hooks)
        // NOTE: All collections use mandatory pagination due to unbounded growth
        { collection: 'subscriptions', read: 'managed', write: 'private', memory: 'stable' },
        { collection: 'usage', read: 'managed', write: 'managed', memory: 'stable' },
        { collection: 'subscription_overrides', read: 'managed', write: 'managed', memory: 'stable' },
        
        { collection: 'organizations', read: 'managed', write: 'private', memory: 'stable' },
        { collection: 'organization_members', read: 'managed', write: 'private', memory: 'stable' },
        { collection: 'organization_invitations', read: 'managed', write: 'private', memory: 'stable' },
        { collection: 'contact_submissions', read: 'managed', write: 'public', memory: 'stable' },
        { collection: 'activity_logs', read: 'managed', write: 'private', memory: 'stable' },
        { collection: 'user_profiles', read: 'managed', write: 'private', memory: 'stable' },
        { collection: 'notifications', read: 'managed', write: 'private', memory: 'stable' },
        
        // Security collections - RESTRICTED write (satellite-only for integrity)
        { collection: 'rate_limits', read: 'managed', write: 'managed', memory: 'stable' },
        { collection: 'security_events', read: 'managed', write: 'managed', memory: 'stable' },
        { collection: 'admin_notifications', read: 'managed', write: 'managed', memory: 'stable' },
        
        // Download/Export validation collections
        { collection: 'download_requests', read: 'managed', write: 'managed', memory: 'stable' },
        { collection: 'export_usage', read: 'managed', write: 'managed', memory: 'stable' },
        
        // Admin collections
        { collection: 'platform_admins', read: 'public', write: 'managed', memory: 'stable' },
        { collection: 'admin_actions', read: 'managed', write: 'managed', memory: 'stable' },
        { collection: 'suspended_users', read: 'managed', write: 'managed', memory: 'stable' },
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
          ? "968488381684-58c8vsnsaae26g6gca08ahh1ghjd9npg.apps.googleusercontent.com"
          : "YOUR_PRODUCTION_CLIENT_ID.apps.googleusercontent.com"
      }
    }
  }
}));
