import {
  coreServices,
  createBackendPlugin,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import express from 'express';

/**
 * Optional Notifications service
 */
const notificationsServiceRef = createServiceRef<{
  createNotification(options: {
    recipients: { type: 'entity'; entityRef: string };
    payload: {
      title: string;
      description?: string;
      severity?: 'low' | 'normal' | 'high' | 'critical';
      link?: string;
    };
  }): Promise<void>;
}>({
  id: 'notifications',
});

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

        // 🔑 OPTIONAL dependency
        notifications: notificationsServiceRef.optional(),
      },
      async init({ logger, httpRouter, config, notifications }) {
        const router = express.Router();
        router.use(express.json());

        router.use((req, res, next) => {
          const token = config.getOptionalString('webhook.token');
          if (!token) return next();

          if (req.headers.authorization === `Bearer ${token}`) {
            return next();
          }

          return res.status(401).json({ error: 'Unauthorized' });
        });

        router.post('/', async (req, res) => {
          try {
            const payload = req.body ?? {};
            const entityRef = resolveRecipient(payload);

            if (!entityRef) {
              return res.status(400).json({ error: 'Missing recipient' });
            }

            const title = payload.title ?? 'Webhook Notification';
            const severity: 'low' | 'normal' | 'high' | 'critical' =
              ['low', 'normal', 'high', 'critical'].includes(payload.severity)
                ? payload.severity
                : 'normal';

            const description =
              payload.description ?? 'Status update received';

            const link =
              payload.link ??
              (payload.taskId ? `/tasks/${payload.taskId}` : undefined);

            // 🔔 Only send notification if service exists
            if (notifications) {
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
            } else {
              logger.warn(
                'Notifications service not available; skipping notification',
                { entityRef, title },
              );
            }

            return res.json({ success: true });
          } catch (error) {
            logger.error('Webhook handler failed', error);
            return res.status(500).json({ error: 'Internal error' });
          }
        });

        router.get('/health', (_req, res) => {
          return res.json({ status: 'ok' });
        });

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
