import Redis from 'ioredis';
import { logger } from '../index.js';

class CacheService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });

    this.redis.on('connect', () => {
      logger.info('Redis cache connected');
    });

    this.redis.on('error', (err) => {
      logger.error('Redis cache error:', err);
    });

    this.defaultTTL = 3600;
  }

  async get(key) {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async getCachedAnalysis(incidentId) {
    const key = `analysis:${incidentId}`;
    const cached = await this.get(key);
    
    if (cached && cached.timestamp) {
      const age = Date.now() - new Date(cached.timestamp).getTime();
      const maxAge = 24 * 60 * 60 * 1000;
      
      if (age < maxAge) {
        logger.info(`Using cached analysis for ${incidentId}, age: ${Math.round(age / 60000)} minutes`);
        return cached;
      }
    }
    
    return null;
  }

  async setCachedAnalysis(incidentId, analysis) {
    const key = `analysis:${incidentId}`;
    const data = {
      ...analysis,
      timestamp: new Date().toISOString(),
      cached: true
    };
    
    const ttl = 24 * 60 * 60;
    await this.set(key, data, ttl);
    logger.info(`Cached analysis for ${incidentId}`);
  }

  async getCachedMetrics(source, startTime, endTime) {
    const key = `metrics:${source}:${startTime.getTime()}:${endTime.getTime()}`;
    return await this.get(key);
  }

  async setCachedMetrics(source, startTime, endTime, metrics, ttl = 300) {
    const key = `metrics:${source}:${startTime.getTime()}:${endTime.getTime()}`;
    await this.set(key, metrics, ttl);
  }

  async invalidateIncident(incidentId) {
    const keys = [
      `analysis:${incidentId}`,
      `incident:${incidentId}`,
      `metrics:*:${incidentId}`
    ];
    
    for (const pattern of keys) {
      if (pattern.includes('*')) {
        const matchingKeys = await this.redis.keys(pattern);
        for (const key of matchingKeys) {
          await this.del(key);
        }
      } else {
        await this.del(pattern);
      }
    }
    
    logger.info(`Invalidated cache for incident ${incidentId}`);
  }

  async getStats() {
    const info = await this.redis.info('stats');
    const dbSize = await this.redis.dbsize();
    
    return {
      connected: this.redis.status === 'ready',
      keys: dbSize,
      info: info
    };
  }

  async acquireLock(key, ttl = 30) {
    const lockKey = `lock:${key}`;
    const lockId = Math.random().toString(36).substring(7);
    
    const acquired = await this.redis.set(lockKey, lockId, 'NX', 'EX', ttl);
    
    if (acquired) {
      return lockId;
    }
    
    return null;
  }

  async releaseLock(key, lockId) {
    const lockKey = `lock:${key}`;
    const currentLockId = await this.redis.get(lockKey);
    
    if (currentLockId === lockId) {
      await this.redis.del(lockKey);
      return true;
    }
    
    return false;
  }
}

export const cacheService = new CacheService();
