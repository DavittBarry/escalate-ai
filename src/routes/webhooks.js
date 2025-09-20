import express from 'express';
import crypto from 'crypto';
import { incidentService } from '../services/incidentService.js';
import { logger } from '../index.js';

const router = express.Router();

function verifyWebhookSignature(req, secret) {
  const signature = req.headers['x-hub-signature-256'] || req.headers['x-signature'];
  if (!signature || !secret) return true;
  
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
  
  return signature === digest;
}

router.post('/jira', async (req, res) => {
  if (!verifyWebhookSignature(req, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    const { issue, webhookEvent } = req.body;
    
    if (webhookEvent === 'jira:issue_created' && issue.fields.issuetype.name === 'Incident') {
      logger.info(`New incident created: ${issue.key}`);
      
      setTimeout(() => {
        incidentService.analyzeIncident(issue.key, 'jira');
      }, 5000);
      
      res.json({ status: 'accepted', issueKey: issue.key });
    } else {
      res.json({ status: 'ignored', reason: 'Not an incident creation' });
    }
  } catch (error) {
    logger.error('JIRA webhook error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

router.post('/datadog', async (req, res) => {
  try {
    const { alert_type, alert_title, event_msg, link } = req.body;
    
    if (alert_type === 'alert') {
      logger.info(`DataDog alert received: ${alert_title}`);
      
      res.json({ status: 'received' });
    } else {
      res.json({ status: 'ignored' });
    }
  } catch (error) {
    logger.error('DataDog webhook error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

router.post('/slack', async (req, res) => {
  try {
    const { type, challenge, event } = req.body;
    
    if (type === 'url_verification') {
      return res.json({ challenge });
    }
    
    if (event?.type === 'message' && event?.text?.includes('incident')) {
      logger.info('Incident mentioned in Slack');
    }
    
    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('Slack webhook error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

router.post('/grafana', async (req, res) => {
  try {
    const { state, ruleName, ruleUrl, message } = req.body;
    
    if (state === 'alerting') {
      logger.info(`Grafana alert: ${ruleName}`);
    }
    
    res.json({ status: 'received' });
  } catch (error) {
    logger.error('Grafana webhook error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

export { router as webhookRouter };
