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

        // Single generic endpoint that works with ANY webhook source
        router.post('/', async (req, res) => {
          try {
            const payload = req.body;
            
            logger.info('Webhook received', { 
              source: req.headers['x-source'] || 'unknown',
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
                hint: 'Include backstage_user, user, userId, or username in payload'
              });
            }

            // Extract notification content - flexible field mapping
            const title = 
              payload.title || 
              payload.subject ||
              payload.name ||
              payload.summary ||
              'Notification';
              
            const message = 
              payload.message || 
              payload.description || 
              payload.body ||
              payload.text ||
              payload.details ||
              JSON.stringify(payload);
            
            const link = 
              payload.link || 
              payload.url || 
              payload.href ||
              payload.web_url;
            
            const severity = 
              ['low', 'normal', 'high', 'critical'].includes(payload.severity)
                ? payload.severity
                : (payload.status === 'failed' || payload.status === 'error')
                  ? 'high'
                  : 'normal';
            
            const topic = 
              payload.topic ||
              payload.source ||
              payload.type ||
              req.headers['x-source'] ||
              'webhook';

            // Log the webhook data (notifications will be handled separately)
            logger.info('Webhook processed', { 
              user: targetUser, 
              topic,
              title,
              severity 
            });

            return res.status(200).json({ 
              success: true,
              message: 'Webhook received',
              data: {
                user: targetUser,
                title,
                topic
              }
            });

          } catch (error: any) {
            logger.error('Webhook processing failed', { error: error.message });
            return res.status(500).json({ error: error.message });
          }
        });

        // Optional: Source-specific endpoints
        router.post('/aap', async (req, res) => {
          req.body.source = req.body.source || 'aap';
          req.headers['x-source'] = 'aap';
          
          // Call the main handler
          const payload = req.body;
          const targetUser = 
            payload.backstage_user ||
            payload.user ||
            payload.userId;
          
          if (!targetUser) {
            return res.status(400).json({ 
              error: 'Missing user identifier',
              hint: 'Include backstage_user, user, or userId in payload'
            });
          }

          logger.info('AAP webhook received', { payload, user: targetUser });
          
          return res.status(200).json({ 
            success: true,
            source: 'aap',
            user: targetUser
          });
        });

        router.post('/github', async (req, res) => {
          req.body.source = req.body.source || 'github';
          req.headers['x-source'] = 'github';
          
          const payload = req.body;
          const targetUser = 
            payload.backstage_user ||
            payload.user ||
            payload.userId;
          
          if (!targetUser) {
            return res.status(400).json({ 
              error: 'Missing user identifier'
            });
          }

          logger.info('GitHub webhook received', { payload, user: targetUser });
          
          return res.status(200).json({ 
            success: true,
            source: 'github',
            user: targetUser
          });
        });

        router.post('/aws', async (req, res) => {
          req.body.source = req.body.source || 'aws';
          req.headers['x-source'] = 'aws';
          
          const payload = req.body;
          const targetUser = 
            payload.backstage_user ||
            payload.username ||
            payload.user;
          
          if (!targetUser) {
            return res.status(400).json({ 
              error: 'Missing user identifier'
            });
          }

          logger.info('AWS webhook received', { payload, user: targetUser });
          
          return res.status(200).json({ 
            success: true,
            source: 'aws',
            user: targetUser
          });
        });

        // Health check
        router.get('/health', (_req, res) => {
          res.json({ 
            status: 'ok',
            endpoints: {
              generic: '/api/webhook',
              aap: '/api/webhook/aap',
              github: '/api/webhook/github',
              aws: '/api/webhook/aws',
              health: '/api/webhook/health'
            }
          });
        });

        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/webhook',
          allow: 'unauthenticated',
        });

        logger.info('Generic webhook plugin initialized', {
          endpoint: '/api/webhook',
          sources: ['generic', 'aap', 'github', 'aws']
        });
      },
    });
  },
});
