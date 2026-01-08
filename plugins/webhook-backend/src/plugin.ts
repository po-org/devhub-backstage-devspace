import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import express from 'express';

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

        // JSON body parsing
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

            logger.info('Webhook received', { source });

            const targetUser =
              payload.backstage_user ||
              payload.user ||
              payload.userId ||
              payload.user_id ||
              payload.username ||
              payload.email?.split('@')[0];

            if (!targetUser) {
              return res.status(400).json({
                error: 'Missing user identifier',
                hint:
                  'Include backstage_user, user, userId, user_id, username, or email in payload',
              });
            }

            const title =
              payload.title ||
              payload.subject ||
              payload.name ||
              payload.summary ||
              'Webhook Notification';

            const severity =
              ['low', 'normal', 'high', 'critical'].includes(payload.severity)
                ? payload.severity
                : payload.status === 'failed' || payload.status === 'error'
                ? 'high'
                : 'normal';

            const topic = payload.topic || payload.type || source;

            logger.info('Webhook processed', {
              user: targetUser,
              title,
              topic,
              severity,
            });

            return res.status(200).json({
              success: true,
              data: {
                user: targetUser,
                source,
                title,
                topic,
                severity,
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
            auth:
              config.getOptionalString('webhook.token')
                ? 'bearer-token'
                : 'open',
          });
        });

        /**
         * IMPORTANT:
         * - DO NOT pass a path
         * - Backstage mounts this at /api/webhook automatically
         */
        httpRouter.use(router);

        /**
         * Auth policy paths are RELATIVE to /api/webhook
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
