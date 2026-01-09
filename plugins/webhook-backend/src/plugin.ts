import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { notificationsServiceRef } from '@backstage/plugin-notifications-node';
import express from 'express';

function resolveRecipient(payload: any): string | undefined {
  const raw =
    payload.recipient ||
    payload.backstage_user ||
    payload.user ||
    payload.username ||
    payload.group;

  if (!raw) {
    return undefined;
  }

  // If already a full entityRef, trust it
  if (
    typeof raw === 'string' &&
    (raw.startsWith('user:') || raw.startsWith('group:'))
  ) {
    return raw;
  }

  // Explicit group field
  if (payload.group) {
    return `group:default/${raw}`;
  }

  // Default to user
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
        notifications: notificationsServiceRef,
      },
      async init({ logger, httpRouter, config, notifications }) {
        const router = express.Router();

        router.use(express.json());

        // Optional Bearer token auth
        router.use((req, res, next) => {
          const token = config.getOptionalString('webhook.token');
          const authHeader = req.headers.authorization;

          if (!token) {
            return next();
          }

          if (authHeader === `Bearer ${token}`) {
            return next();
          }

          logger.warn('Unauthorized webhook request');
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Valid Authorization Bearer token required',
          });
        });

        /**
         * POST /api/webhook
         */
        router.post('/', async (req, res) => {
          try {
            const payload = req.body ?? {};

            const source =
              req.headers['x-source'] ||
              payload.source ||
              'unknown';

            const entityRef = resolveRecipient(payload);

            if (!entityRef) {
              return res.status(400).json({
                error: 'Missing recipient',
                hint:
                  'Include recipient, backstage_user, user, username, or group',
              });
            }

            const title =
              payload.title ||
              payload.subject ||
              payload.name ||
              payload.summary ||
              'Webhook Notification';

            const severity: 'low' | 'normal' | 'high' | 'critical' =
              ['low', 'normal', 'high', 'critical'].includes(payload.severity)
                ? payload.severity
                : payload.status === 'failed' ||
                  payload.status === 'error'
                ? 'high'
                : 'normal';

            const description =
              payload.description ||
              payload.message ||
              `Status update from ${source}`;

            const link =
              payload.link ||
              payload.url ||
              (payload.taskId
                ? `/tasks/${payload.taskId}`
                : undefined);

            logger.info('Creating notification', {
              recipient: entityRef,
              title,
              severity,
            });

            // 🔔 RHDH Notifications API
            await notifications.createNotification({
              recipients: {
                type: 'entity',
                entityRef,
              },
              payload: {
                title,
                description,
                severity,
                link,
              },
            });

            return res.status(200).json({
              success: true,
              notification: {
                recipient: entityRef,
                title,
                severity,
                link,
              },
            });
          } catch (error) {
            logger.error('Webhook handler failed', error);
            return res.status(500).json({
              success: false,
              error: 'Internal server error',
            });
          }
        });

        /**
         * GET /api/webhook/health
         */
        router.get('/health', (_req, res) => {
          res.json({
            status: 'ok',
            plugin: 'webhook',
            endpoint: '/api/webhook',
            auth: config.getOptionalString('webhook.token')
              ? 'bearer-token'
              : 'open',
          });
        });

        // Backstage mounts this at /api/webhook
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
