import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import express from 'express';
import fetch from 'node-fetch';

/**
 * Resolve a webhook payload into a Backstage entityRef
 */
function resolveRecipient(payload: any): string | undefined {
  const raw =
    payload.recipient ||
    payload.backstage_user ||
    payload.user ||
    payload.username ||
    payload.group;

  if (!raw) return undefined;

  if (raw.startsWith('user:') || raw.startsWith('group:')) {
    return raw;
  }

  if (payload.group) {
    return `group:default/${raw}`;
  }

  return `user:default/${raw}`;
}

export const webhookPlugin = createBackendPlugin({
  pluginId: 'webhook',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
        config: coreServices.rootConfig,
      },
      async init({ logger, httpRouter, config }) {
        const router = express.Router();
        router.use(express.json());

        /**
         * 🔐 Shared secret authentication
         * (recommended for webhooks)
         */
        router.use((req, res, next) => {
          const configuredSecret =
            config.getOptionalString('webhook.secret');

          // If no secret configured, allow all (dev mode)
          if (!configuredSecret) {
            return next();
          }

          const providedSecret = req.header('x-webhook-secret');

          if (providedSecret !== configuredSecret) {
            logger.warn('Rejected webhook: invalid secret');
            return res.status(401).json({ error: 'Unauthorized' });
          }

          return next();
        });

        /**
         * POST /api/webhook
         */
        router.post('/', async (req, res) => {
          try {
            const payload = req.body ?? {};
            const entityRef = resolveRecipient(payload);

            if (!entityRef) {
              return res.status(400).json({
                error: 'Missing recipient',
              });
            }

            const title = payload.title ?? 'Webhook Notification';
            const description =
              payload.description ?? 'Status update received';

            const severity =
              ['low', 'normal', 'high', 'critical'].includes(payload.severity)
                ? payload.severity
                : 'normal';

            const backendBaseUrl =
              config.getString('backend.baseUrl');

            /**
             * 🔔 Call Notifications backend via REST API
             * (ONLY supported method in RHDH 1.7)
             */
            await fetch(`${backendBaseUrl}/api/notifications`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                recipients: {
                  type: 'entity',
                  entityRef,
                },
                payload: {
                  title,
                  description,
                  severity,
                  link: payload.link,
                },
              }),
            });

            return res.json({ success: true });
          } catch (error) {
            logger.error('Webhook handler failed', error);
            return res.status(500).json({
              error: 'Internal server error',
            });
          }
        });

        /**
         * GET /api/webhook/health
         */
        router.get('/health', (_req, res) => {
          return res.json({ status: 'ok' });
        });

        /**
         * Mount router at /api/webhook
         */
        httpRouter.use(router);

        /**
         * 🔓 Allow unauthenticated access
         * (required for external webhooks)
         */
        httpRouter.addAuthPolicy({
          path: '/',
          allow: 'unauthenticated',
        });

        logger.info('Webhook backend plugin initialized', {
          endpoint: '/api/webhook',
        });
      },
    });
  },
});
