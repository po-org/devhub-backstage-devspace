import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import express from 'express';
import fetch from 'node-fetch';

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

        router.post('/', async (req, res) => {
          try {
            const payload = req.body ?? {};
            const recipient = resolveRecipient(payload);

            if (!recipient) {
              return res.status(400).json({ error: 'Missing recipient' });
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

            await fetch(`${backendBaseUrl}/api/notifications`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                recipients: {
                  type: 'entity',
                  entityRef: recipient,
                },
                payload: {
                  title,
                  description,
                  severity,
                },
              }),
            });

            return res.json({ success: true });
          } catch (error) {
            logger.error('Webhook failed', error);
            return res.status(500).json({ error: 'Internal error' });
          }
        });

        httpRouter.use(router);
      },
    });
  },
});
