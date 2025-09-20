import express from 'express';
import dotenv from 'dotenv';
import winston from 'winston';
import { webhookRouter } from './routes/webhooks.js';
import { incidentService } from './services/incidentService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/webhooks', webhookRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/analyze-incident', async (req, res) => {
  try {
    const { incidentId, source } = req.body;
    logger.info(`Analyzing incident ${incidentId} from ${source}`);
    
    const analysis = await incidentService.analyzeIncident(incidentId, source);
    res.json(analysis);
  } catch (error) {
    logger.error('Error analyzing incident:', error);
    res.status(500).json({ error: 'Failed to analyze incident' });
  }
});

app.listen(PORT, () => {
  logger.info(`EscalateAI server running on port ${PORT}`);
});

export { app, logger };
