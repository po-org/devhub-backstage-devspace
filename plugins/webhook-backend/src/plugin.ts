import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import express from 'express';
import fetch from 'node-fetch';

/**
 * Resolve webhook payload into a Backstage entityRef
 */
function resolveRecipient(payload: any): string | undefined {
  if (payload.recipient) {
    return payload.recipient;
  }

  if (payload.group) {
    return payload.group.startsWith('group:')
      ? payload.group
      : `group:default/${payload.group}`;
  }

  const user =
    payload.backstage_user ||
    payload.user ||
    payload.username;

  if (!user) return undefined;

  return user.startsWith('user:')
    ? user
    : `user:default/${user}`;
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
         * 🔐 Webhook shared-secret auth (external callers only)
         */
        router.use((req, res, next) => {
          const expected = config.getOptionalString('webhook.token');
          if (!expected) return next();

          const provided = req.header('x-webhook-secret');
          if (provided !== expected) {
            logger.warn('Rejected webhook request: invalid secret');
            return res.status(401).json({ error: 'Unauthorized' });
          }

          next();
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
                error: 'Missing recipient (user or group)',
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
             * 🔑 AUTHENTICATE TO THE BACKEND PROXY (REQUIRED)
             */
            const authKeys =
              config.getConfigArray('backend.auth.keys');

            if (!authKeys.length) {
              throw new Error(
                'backend.auth.keys is not configured',
              );
            }

            const backendToken =
              authKeys[0].getString('secret');

            /**
             * ✅ CALL NOTIFICATIONS THROUGH THE PROXY
             */
            const response = await fetch(
              `${backendBaseUrl}/api/proxy/notify-api`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${backendToken}`,
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
              },
            );

            if (!response.ok) {
              const body = await response.text();
              logger.error('Notification creation failed', {
                status: response.status,
                body,
              });
              return res.status(502).json({
                error: 'Failed to create notification',
              });
            }

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
          res.json({ status: 'ok' });
        });

        /**
         * Mount router and allow unauthenticated access
         */
        httpRouter.use(router);
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
