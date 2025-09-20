import express from 'express';
import { Incident, Analysis, Pattern } from '../models/index.js';
import { incidentService } from '../services/incidentService.js';
import { queueService } from '../services/queueService.js';
import { cacheService } from '../services/cacheService.js';
import { validate, validateQuery } from '../middleware/validation.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { logger, emitIncidentUpdate } from '../index.js';
import { Op } from 'sequelize';

const router = express.Router();

router.post('/analyze-incident', 
  validate('analyzeIncident'),
  asyncHandler(async (req, res) => {
    const { incidentId, source, force, priority } = req.validatedBody;
    
    if (!force) {
      const cached = await cacheService.getCachedAnalysis(incidentId);
      if (cached) {
        return res.json({
          ...cached,
          fromCache: true
        });
      }
    }
    
    const existingIncident = await Incident.findByPk(incidentId);
    if (existingIncident && !force) {
      const lastAnalysis = await Analysis.findOne({
        where: { incidentId },
        order: [['createdAt', 'DESC']]
      });
      
      if (lastAnalysis) {
        const age = Date.now() - new Date(lastAnalysis.createdAt).getTime();
        if (age < 60 * 60 * 1000) {
          return res.json({
            message: 'Recent analysis exists',
            analysisId: lastAnalysis.id,
            age: Math.round(age / 60000) + ' minutes'
          });
        }
      }
    }
    
    const job = await queueService.addAnalysisJob(incidentId, source, {
      force,
      severity: priority
    });
    
    const analysis = await Analysis.create({
      incidentId,
      status: 'pending',
      triggeredBy: 'api'
    });
    
    res.json({
      message: 'Analysis queued',
      jobId: job.id,
      analysisId: analysis.id,
      incidentId
    });
  })
);

router.get('/incidents',
  validateQuery('searchIncidents'),
  asyncHandler(async (req, res) => {
    const { query, severity, status, startDate, endDate, limit, offset } = req.validatedQuery;
    
    const where = {};
    
    if (query) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${query}%` } },
        { description: { [Op.iLike]: `%${query}%` } }
      ];
    }
    
    if (severity) where.severity = severity;
    if (status) where.status = status;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = startDate;
      if (endDate) where.createdAt[Op.lte] = endDate;
    }
    
    const incidents = await Incident.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{
        model: Analysis,
        as: 'analyses',
        limit: 1,
        order: [['createdAt', 'DESC']]
      }]
    });
    
    res.json({
      total: incidents.count,
      incidents: incidents.rows,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(incidents.count / limit)
    });
  })
);

router.get('/incidents/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const incident = await Incident.findByPk(id, {
      include: [{
        model: Analysis,
        as: 'analyses',
        order: [['createdAt', 'DESC']]
      }]
    });
    
    if (!incident) {
      throw new AppError('Incident not found', 404);
    }
    
    res.json(incident);
  })
);

router.patch('/incidents/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    const incident = await Incident.findByPk(id);
    if (!incident) {
      throw new AppError('Incident not found', 404);
    }
    
    await incident.update(updates);
    
    emitIncidentUpdate(id, {
      type: 'update',
      data: incident
    });
    
    res.json(incident);
  })
);

router.post('/incidents/:id/reanalyze',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const incident = await Incident.findByPk(id);
    if (!incident) {
      throw new AppError('Incident not found', 404);
    }
    
    await cacheService.invalidateIncident(id);
    
    const job = await queueService.addAnalysisJob(id, incident.source, {
      force: true,
      severity: incident.severity
    });
    
    const analysis = await Analysis.create({
      incidentId: id,
      status: 'pending',
      triggeredBy: 'manual-reanalysis'
    });
    
    res.json({
      message: 'Reanalysis queued',
      jobId: job.id,
      analysisId: analysis.id
    });
  })
);

router.get('/patterns',
  asyncHandler(async (req, res) => {
    const patterns = await Pattern.findAll({
      order: [['occurrences', 'DESC']],
      limit: 20
    });
    
    res.json(patterns);
  })
);

router.get('/stats',
  asyncHandler(async (req, res) => {
    const [
      totalIncidents,
      openIncidents,
      avgMttr,
      todayIncidents,
      weeklyTrend,
      topServices
    ] = await Promise.all([
      Incident.count(),
      Incident.count({ where: { status: 'open' } }),
      Incident.aggregate('mttr', 'avg'),
      Incident.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      getWeeklyTrend(),
      getTopAffectedServices()
    ]);
    
    res.json({
      totalIncidents,
      openIncidents,
      avgMttr: Math.round(avgMttr || 0),
      todayIncidents,
      weeklyTrend,
      topServices
    });
  })
);

router.get('/queue-stats',
  asyncHandler(async (req, res) => {
    const stats = await queueService.getQueueStats();
    res.json(stats);
  })
);

router.post('/queue/:name/pause',
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    await queueService.pauseQueue(name);
    res.json({ message: `Queue ${name} paused` });
  })
);

router.post('/queue/:name/resume',
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    await queueService.resumeQueue(name);
    res.json({ message: `Queue ${name} resumed` });
  })
);

router.post('/cache/invalidate/:incidentId',
  asyncHandler(async (req, res) => {
    const { incidentId } = req.params;
    await cacheService.invalidateIncident(incidentId);
    res.json({ message: `Cache invalidated for incident ${incidentId}` });
  })
);

async function getWeeklyTrend() {
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const count = await Incident.count({
      where: {
        createdAt: {
          [Op.gte]: date,
          [Op.lt]: nextDate
        }
      }
    });
    
    trend.push({
      date: date.toISOString().split('T')[0],
      count
    });
  }
  return trend;
}

async function getTopAffectedServices() {
  const incidents = await Incident.findAll({
    attributes: ['affectedServices'],
    where: {
      affectedServices: {
        [Op.ne]: []
      }
    }
  });
  
  const serviceCounts = {};
  incidents.forEach(incident => {
    incident.affectedServices.forEach(service => {
      serviceCounts[service] = (serviceCounts[service] || 0) + 1;
    });
  });
  
  return Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([service, count]) => ({ service, count }));
}

export { router as apiRouter };
