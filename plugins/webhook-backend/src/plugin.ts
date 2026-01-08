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
        config: coreServices.rootConfig,
      },
      async init({ logger, httpRouter, config }) {
        const router = Router();
        router.use(express.json());

        // Simple token validation middleware
        router.use((req, res, next) => {
          const authHeader = req.headers.authorization;
          const webhookToken = config.getOptionalString('webhook.token');
          
          if (!webhookToken) {
            // No token configured, allow all
            logger.debug('No webhook token configured, allowing request');
            return next();
          }
          
          if (authHeader === `Bearer ${webhookToken}`) {
            logger.debug('Valid webhook token');
            return next();
          }
          
          logger.warn('Invalid or missing webhook token');
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Valid Authorization Bearer token required'
          });
        });

        // Webhook endpoint
        router.post('/', async (req, res) => {
          try {
            const payload = req.body;
            const source = req.headers['x-source'] || payload.source || 'unknown';
            
            logger.info('Webhook received', { source, payload });

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
            
            const topic = payload.topic || payload.type || source;

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
          const tokenConfigured = !!config.getOptionalString('webhook.token');
          res.json({ 
            status: 'ok',
            plugin: 'webhook',
            version: '0.1.0',
            endpoint: '/api/webhook',
            authentication: tokenConfigured ? 'Bearer token required' : 'open'
          });
        });

        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/webhook',
          allow: 'unauthenticated',
        });

        const authMethod = config.getOptionalString('webhook.token') 
          ? 'Bearer token authentication' 
          : 'Open access';

        logger.info('Webhook plugin initialized', {
          endpoint: '/api/webhook',
          authentication: authMethod
        });
      },
    });
  },
});
