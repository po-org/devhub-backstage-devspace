import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import express from 'express';
import fetch from 'node-fetch';

function resolveRecipient(payload: any): string | undefined {
  if (payload.recipient) return payload.recipient;

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
         * Webhook shared-secret auth
         */
        router.use((req, res, next) => {
          const expected = config.getOptionalString('webhook.token');
          if (!expected) return next();

          const provided = req.header('x-webhook-secret');
          if (provided !== expected) {
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
                error: 'Missing recipient',
              });
            }

            const backendBaseUrl =
              config.getString('backend.baseUrl');

            const response = await fetch(
              `${backendBaseUrl}/api/proxy/notify-api`,
              {
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
                    title: payload.title ?? 'Webhook Notification',
                    description:
                      payload.description ?? 'Status update',
                    severity: payload.severity ?? 'normal',
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
          } catch (e) {
            logger.error('Webhook handler failed', e);
            return res.status(500).json({
              error: 'Internal server error',
            });
          }
        });

        router.get('/health', (_req, res) => {
          res.json({ status: 'ok' });
        });

        /**
         * Mount webhook routes
         */
        httpRouter.use(router);

        /**
         * ALLOW PROXY CALLS WITHOUT AUTH
         * 
         */
        httpRouter.addAuthPolicy({
          path: '/proxy/notify-api',
          allow: 'unauthenticated',
        });

        httpRouter.addAuthPolicy({
          path: '/',
          allow: 'unauthenticated',
        });

        logger.info('Webhook plugin initialized');
      },
    });
  },
});
