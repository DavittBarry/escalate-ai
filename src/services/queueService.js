import Bull from 'bull';
import { config } from '../config/config.js';
import { logger } from '../index.js';
import { incidentService } from './incidentService.js';
import { Analysis } from '../models/index.js';

class QueueService {
  constructor() {
    this.queues = {};
    this.initQueues();
  }

  initQueues() {
    this.queues.analysis = new Bull('analysis', {
      redis: {
        host: config.redis.host,
        port: config.redis.port
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: config.analysis.maxRetries,
        backoff: {
          type: 'exponential',
          delay: config.analysis.retryDelayMs
        }
      }
    });

    this.queues.notifications = new Bull('notifications', {
      redis: {
        host: config.redis.host,
        port: config.redis.port
      }
    });

    this.queues.patterns = new Bull('patterns', {
      redis: {
        host: config.redis.host,
        port: config.redis.port
      }
    });

    this.setupProcessors();
    this.setupEventHandlers();
  }

  setupProcessors() {
    this.queues.analysis.process(config.queue.concurrency, async (job) => {
      const { incidentId, source, force } = job.data;
      logger.info(`Processing analysis job for incident ${incidentId}`);
      
      const startTime = Date.now();
      
      try {
        await Analysis.update(
          { status: 'processing' },
          { where: { incidentId, status: 'pending' } }
        );
        
        const result = await incidentService.analyzeIncidentWithRetry(incidentId, source, force);
        
        await Analysis.update(
          { 
            status: 'completed',
            duration: Date.now() - startTime
          },
          { where: { incidentId, status: 'processing' } }
        );
        
        return result;
      } catch (error) {
        await Analysis.update(
          { 
            status: 'failed',
            errors: { message: error.message, stack: error.stack }
          },
          { where: { incidentId, status: 'processing' } }
        );
        
        throw error;
      }
    });

    this.queues.notifications.process(async (job) => {
      const { type, data } = job.data;
      logger.info(`Processing notification: ${type}`);
      
      switch (type) {
        case 'slack':
          await this.sendSlackNotification(data);
          break;
        case 'teams':
          await this.sendTeamsNotification(data);
          break;
        case 'email':
          await this.sendEmailNotification(data);
          break;
        default:
          logger.warn(`Unknown notification type: ${type}`);
      }
    });

    this.queues.patterns.process(async (job) => {
      const { incidentId } = job.data;
      logger.info(`Analyzing patterns for incident ${incidentId}`);
      
      const patterns = await incidentService.detectPatterns(incidentId);
      return patterns;
    });
  }

  setupEventHandlers() {
    Object.entries(this.queues).forEach(([name, queue]) => {
      queue.on('completed', (job, result) => {
        logger.info(`Job ${job.id} in queue ${name} completed`);
      });

      queue.on('failed', (job, err) => {
        logger.error(`Job ${job.id} in queue ${name} failed:`, err);
      });

      queue.on('stalled', (job) => {
        logger.warn(`Job ${job.id} in queue ${name} stalled`);
      });
    });
  }

  async addAnalysisJob(incidentId, source = 'jira', options = {}) {
    const job = await this.queues.analysis.add({
      incidentId,
      source,
      force: options.force || false
    }, {
      priority: this.getPriority(options.severity),
      delay: options.delay || 0
    });
    
    logger.info(`Added analysis job ${job.id} for incident ${incidentId}`);
    return job;
  }

  async addNotificationJob(type, data, options = {}) {
    const job = await this.queues.notifications.add({
      type,
      data
    }, options);
    
    return job;
  }

  async addPatternDetectionJob(incidentId, options = {}) {
    const job = await this.queues.patterns.add({
      incidentId
    }, {
      delay: options.delay || 60000
    });
    
    return job;
  }

  getPriority(severity) {
    const priorities = {
      'P1': 10,
      'P2': 5,
      'P3': 2,
      'P4': 1
    };
    return priorities[severity] || 1;
  }

  async getQueueStats() {
    const stats = {};
    
    for (const [name, queue] of Object.entries(this.queues)) {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount()
      ]);
      
      stats[name] = {
        waiting,
        active,
        completed,
        failed,
        delayed
      };
    }
    
    return stats;
  }

  async cleanQueues() {
    for (const queue of Object.values(this.queues)) {
      await queue.clean(24 * 60 * 60 * 1000, 'completed');
      await queue.clean(7 * 24 * 60 * 60 * 1000, 'failed');
    }
    
    logger.info('Cleaned old jobs from queues');
  }

  async pauseQueue(queueName) {
    if (this.queues[queueName]) {
      await this.queues[queueName].pause();
      logger.info(`Queue ${queueName} paused`);
    }
  }

  async resumeQueue(queueName) {
    if (this.queues[queueName]) {
      await this.queues[queueName].resume();
      logger.info(`Queue ${queueName} resumed`);
    }
  }

  async sendSlackNotification(data) {
    logger.info('Sending Slack notification', data);
  }

  async sendTeamsNotification(data) {
    logger.info('Sending Teams notification', data);
  }

  async sendEmailNotification(data) {
    logger.info('Sending email notification', data);
  }
}

export const queueService = new QueueService();
