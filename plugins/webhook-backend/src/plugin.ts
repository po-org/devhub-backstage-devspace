import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { Router } from 'express';
import express from 'express';

export const webhookPlugin = createBackendPlugin({
  pluginId: 'webhook',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
      },
      async init({ logger, httpRouter }) {
        const router = Router();
        router.use(express.json());

        // Bypass authentication middleware
        router.use((req, res, next) => {
          // Allow all requests without authentication
          next();
        });

        // Single generic endpoint that works with ANY webhook source
        router.post('/', async (req, res) => {
          try {
            const payload = req.body;
            
            const source = req.headers['x-source'] || payload.source || 'unknown';
            
            logger.info('Webhook received', { 
              source,
              payload 
            });

            // Extract user - support multiple common field names
            const targetUser = 
              payload.backstage_user ||
              payload.user ||
              payload.userId ||
              payload.user_id ||
              payload.username ||
              payload.email?.split('@')[0];
            
            if (!targetUser) {
              logger.warn('No user identifier found in webhook');
              return res.status(400).json({ 
                error: 'Missing user identifier',
                hint: 'Include backstage_user, user, userId, user_id, username, or email in payload'
              });
            }

            // Extract notification content - flexible field mapping
            const title = 
              payload.title || 
              payload.subject ||
              payload.name ||
              payload.summary ||
              'Webhook Notification';
            
            const severity = 
              ['low', 'normal', 'high', 'critical'].includes(payload.severity)
                ? payload.severity
                : (payload.status === 'failed' || payload.status === 'error')
                  ? 'high'
                  : 'normal';
            
            const topic = 
              payload.topic ||
              payload.type ||
              source;

            // Log the webhook data
            logger.info('Webhook processed successfully', { 
              user: targetUser, 
              source,
              topic,
              title,
              severity 
            });

            return res.status(200).json({ 
              success: true,
              message: 'Webhook received and processed',
              data: {
                user: targetUser,
                source,
                title,
                topic,
                severity
              }
            });

          } catch (error: any) {
            logger.error('Webhook processing failed', { 
              error: error.message,
              stack: error.stack 
            });
            return res.status(500).json({ 
              success: false,
              error: 'Internal server error',
              message: error.message 
            });
          }
        });

        // Health check
        router.get('/health', (_req, res) => {
          res.json({ 
            status: 'ok',
            plugin: 'webhook',
            version: '0.1.0',
            endpoint: '/api/webhook'
          });
        });

        httpRouter.use(router);
        
        // Try both auth policy methods
        httpRouter.addAuthPolicy({
          path: '/webhook',
          allow: 'unauthenticated',
        });
        
        httpRouter.addAuthPolicy({
          path: '/webhook/health',
          allow: 'unauthenticated',
        });

        logger.info('Generic webhook plugin initialized at /api/webhook');
      },
    });
  },
});
