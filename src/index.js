import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import winston from 'winston';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config, validateConfig } from './config/config.js';
import { connectDatabase } from './db/database.js';
import { cacheService } from './services/cacheService.js';
import { queueService } from './services/queueService.js';
import { webhookRouter } from './routes/webhooks.js';
import { apiRouter } from './routes/api.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    methods: ['GET', 'POST']
  }
});

export const logger = winston.createLogger({
  level: config.app.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  req.startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`
    });
  });
  next();
});

app.get('/health', async (req, res) => {
  const cacheStats = await cacheService.getStats();
  const queueStats = await queueService.getQueueStats();
  
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cache: cacheStats,
    queues: queueStats,
    memory: process.memoryUsage()
  });
});

app.use('/webhooks', webhookRouter);
app.use('/api', apiLimiter, apiRouter);

app.get('/metrics', async (req, res) => {
  const metrics = await collectMetrics();
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

app.use(notFoundHandler);
app.use(errorHandler);

io.on('connection', (socket) => {
  logger.info(`WebSocket client connected: ${socket.id}`);
  
  socket.on('subscribe-incident', (incidentId) => {
    socket.join(`incident:${incidentId}`);
    logger.info(`Client ${socket.id} subscribed to incident ${incidentId}`);
  });
  
  socket.on('unsubscribe-incident', (incidentId) => {
    socket.leave(`incident:${incidentId}`);
    logger.info(`Client ${socket.id} unsubscribed from incident ${incidentId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`WebSocket client disconnected: ${socket.id}`);
  });
});

export function emitIncidentUpdate(incidentId, data) {
  io.to(`incident:${incidentId}`).emit('incident-update', data);
}

async function collectMetrics() {
  const stats = await queueService.getQueueStats();
  const cacheStats = await cacheService.getStats();
  
  let metrics = '# HELP escalateai_queue_jobs Queue job counts\n';
  metrics += '# TYPE escalateai_queue_jobs gauge\n';
  
  for (const [queue, counts] of Object.entries(stats)) {
    for (const [status, count] of Object.entries(counts)) {
      metrics += `escalateai_queue_jobs{queue="${queue}",status="${status}"} ${count}\n`;
    }
  }
  
  metrics += '# HELP escalateai_cache_keys Total cache keys\n';
  metrics += '# TYPE escalateai_cache_keys gauge\n';
  metrics += `escalateai_cache_keys ${cacheStats.keys}\n`;
  
  return metrics;
}

async function startServer() {
  const configValidation = validateConfig();
  
  if (!configValidation.valid) {
    logger.error('Configuration errors:', configValidation.errors);
    if (config.app.env === 'production') {
      process.exit(1);
    }
  }
  
  try {
    await connectDatabase();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed:', error);
    if (config.app.env === 'production') {
      process.exit(1);
    }
  }
  
  const cacheStats = await cacheService.getStats();
  if (!cacheStats.connected) {
    logger.warn('Redis cache not connected');
  }
  
  httpServer.listen(config.app.port, () => {
    logger.info(`EscalateAI server running on port ${config.app.port}`);
    logger.info(`Environment: ${config.app.env}`);
    logger.info(`Enabled integrations: ${Object.keys(config.integrations).filter(k => config.integrations[k].enabled).join(', ')}`);
  });
  
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

async function gracefulShutdown() {
  logger.info('Starting graceful shutdown...');
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
  
  await queueService.pauseQueue('analysis');
  await queueService.pauseQueue('notifications');
  
  setTimeout(() => {
    logger.info('Forcing shutdown');
    process.exit(0);
  }, 10000);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export { app, httpServer, io };
