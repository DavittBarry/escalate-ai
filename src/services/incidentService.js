import { claudeService } from './claudeService.js';
import { jiraIntegration } from '../integrations/jira.js';
import { datadogIntegration } from '../integrations/datadog.js';
import { grafanaIntegration } from '../integrations/grafana.js';
import { slackIntegration } from '../integrations/slack/slack.js';
import { teamsIntegration } from '../integrations/teams/teams.js';
import { honeycombIntegration } from '../integrations/honeycomb/honeycomb.js';
import { argoIntegration } from '../integrations/argo/argo.js';
import { cacheService } from './cacheService.js';
import { Incident, Analysis, Pattern } from '../models/index.js';
import { logger, emitIncidentUpdate } from '../index.js';
import { config } from '../config/config.js';
import PQueue from 'p-queue';
import { Op } from 'sequelize';

class IncidentService {
  constructor() {
    this.queue = new PQueue({ concurrency: config.queue.concurrency });
  }

  async analyzeIncident(incidentId, source = 'jira', forceRefresh = false) {
    return this.queue.add(async () => {
      logger.info(`Starting analysis for incident ${incidentId}`);
      
      try {
        if (!forceRefresh) {
          const cached = await cacheService.getCachedAnalysis(incidentId);
          if (cached) {
            return cached;
          }
        }
        
        const incidentData = await this.gatherIncidentData(incidentId, source);
        
        await this.saveIncidentToDb(incidentData);
        
        const startTime = Date.now();
        const summary = await claudeService.generateIncidentSummary(incidentData);
        const duration = Date.now() - startTime;
        
        const analysis = await this.saveAnalysis(incidentId, summary, duration);
        
        await this.postAnalysisResults(incidentId, summary, incidentData);
        
        await cacheService.setCachedAnalysis(incidentId, {
          incidentId,
          summary,
          analysis,
          timestamp: new Date().toISOString()
        });
        
        if (config.analysis.enablePatternDetection) {
          await this.detectPatterns(incidentId);
        }
        
        emitIncidentUpdate(incidentId, {
          type: 'analysis-complete',
          data: { summary, analysisId: analysis.id }
        });
        
        return {
          incidentId,
          summary,
          analysisId: analysis.id,
          duration,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        logger.error(`Failed to analyze incident ${incidentId}:`, error);
        
        await Analysis.create({
          incidentId,
          status: 'failed',
          errors: { message: error.message, stack: error.stack }
        });
        
        throw error;
      }
    });
  }

  async analyzeIncidentWithRetry(incidentId, source = 'jira', forceRefresh = false) {
    let attempts = 0;
    const maxAttempts = config.analysis.maxRetries;
    
    while (attempts < maxAttempts) {
      try {
        return await this.analyzeIncident(incidentId, source, forceRefresh);
      } catch (error) {
        attempts++;
        
        if (attempts >= maxAttempts) {
          logger.error(`Max retries reached for incident ${incidentId}`);
          throw error;
        }
        
        const delay = config.analysis.retryDelayMs * Math.pow(2, attempts - 1);
        logger.warn(`Retry ${attempts}/${maxAttempts} for incident ${incidentId} after ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async gatherIncidentData(incidentId, source) {
    const lockId = await cacheService.acquireLock(`incident:${incidentId}`, 60);
    
    if (!lockId) {
      throw new Error('Could not acquire lock for incident analysis');
    }
    
    try {
      const data = {
        id: incidentId,
        source,
        timestamp: new Date().toISOString()
      };

      if (source === 'jira' && config.integrations.jira.enabled) {
        try {
          const issue = await jiraIntegration.getIssue(incidentId);
          data.title = issue.fields.summary;
          data.description = issue.fields.description;
          data.severity = issue.fields.priority?.name || 'Unknown';
          data.created = issue.fields.created;
          data.status = issue.fields.status?.name;
        } catch (error) {
          logger.error('Failed to get JIRA issue:', error);
          data.errors = { jira: error.message };
        }
      }

      const startTime = new Date(data.created || Date.now() - config.analysis.timeWindowMinutes * 60000);
      const endTime = new Date();
      
      const gatherPromises = [];
      const dataSources = {};
      
      if (config.integrations.datadog.enabled) {
        gatherPromises.push(
          this.gatherDataDogMetrics(startTime, endTime)
            .then(metrics => {
              data.metrics = { ...data.metrics, datadog: metrics };
              dataSources.datadog = true;
            })
            .catch(error => {
              logger.error('DataDog gathering failed:', error);
              dataSources.datadog = false;
            })
        );
      }
      
      if (config.integrations.grafana.enabled) {
        gatherPromises.push(
          this.gatherGrafanaData(startTime, endTime)
            .then(alerts => {
              data.metrics = { ...data.metrics, grafana: alerts };
              dataSources.grafana = true;
            })
            .catch(error => {
              logger.error('Grafana gathering failed:', error);
              dataSources.grafana = false;
            })
        );
      }
      
      if (config.integrations.slack.enabled) {
        gatherPromises.push(
          this.searchSlackForIncident(incidentId, startTime, endTime)
            .then(messages => {
              data.slackThread = this.formatSlackMessages(messages);
              dataSources.slack = true;
            })
            .catch(error => {
              logger.error('Slack gathering failed:', error);
              dataSources.slack = false;
            })
        );
      }
      
      await Promise.allSettled(gatherPromises);
      
      data.dataSources = dataSources;
      
      const similarIncidents = await this.findSimilarIncidents(data.title);
      data.similarIncidents = similarIncidents;
      
      return data;
    } finally {
      await cacheService.releaseLock(`incident:${incidentId}`, lockId);
    }
  }

  async saveIncidentToDb(incidentData) {
    const {
      id,
      title,
      description,
      severity,
      status,
      created,
      metrics,
      slackThread,
      teamsMessages,
      similarIncidents
    } = incidentData;
    
    const [incident, created] = await Incident.findOrCreate({
      where: { id },
      defaults: {
        title: title || 'Unknown Incident',
        description,
        severity: severity || 'Unknown',
        status: status || 'open',
        metrics,
        slackThread,
        teamsMessages,
        similarIncidents: similarIncidents?.map(i => i.key) || [],
        startTime: created ? new Date(created) : new Date(),
        analysisCount: 0
      }
    });
    
    if (!created) {
      await incident.increment('analysisCount');
      await incident.update({
        metrics,
        slackThread,
        teamsMessages,
        lastAnalyzedAt: new Date()
      });
    }
    
    return incident;
  }

  async saveAnalysis(incidentId, summary, duration) {
    const analysis = await Analysis.create({
      incidentId,
      summary,
      fullAnalysis: { summary },
      duration,
      status: 'completed',
      model: config.ai.model,
      dataSources: {}
    });
    
    return analysis;
  }

  async findSimilarIncidents(title) {
    if (!title) return [];
    
    const keywords = title.split(' ').slice(0, 3).join(' ');
    
    try {
      if (config.integrations.jira.enabled) {
        return await jiraIntegration.searchSimilarIncidents(keywords);
      }
      
      const similarFromDb = await Incident.findAll({
        where: {
          title: {
            [Op.iLike]: `%${keywords}%`
          }
        },
        limit: config.analysis.maxSimilarIncidents,
        order: [['createdAt', 'DESC']]
      });
      
      return similarFromDb.map(i => ({
        key: i.id,
        summary: i.title,
        created: i.createdAt
      }));
    } catch (error) {
      logger.error('Failed to find similar incidents:', error);
      return [];
    }
  }

  async detectPatterns(incidentId) {
    try {
      const incident = await Incident.findByPk(incidentId);
      if (!incident) return;
      
      const recentIncidents = await Incident.findAll({
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      });
      
      const patterns = this.analyzePatterns(incident, recentIncidents);
      
      for (const pattern of patterns) {
        const [dbPattern, created] = await Pattern.findOrCreate({
          where: {
            type: pattern.type,
            signature: pattern.signature
          },
          defaults: pattern
        });
        
        if (!created) {
          await dbPattern.increment('occurrences');
          await dbPattern.update({
            lastOccurred: new Date(),
            incidents: [...new Set([...dbPattern.incidents, incidentId])],
            confidence: Math.min(1, dbPattern.confidence + 0.1)
          });
        }
      }
      
      return patterns;
    } catch (error) {
      logger.error('Pattern detection failed:', error);
      return [];
    }
  }

  analyzePatterns(incident, recentIncidents) {
    const patterns = [];
    
    const hourOfDay = new Date(incident.createdAt).getHours();
    const sameHourIncidents = recentIncidents.filter(i => 
      new Date(i.createdAt).getHours() === hourOfDay
    );
    
    if (sameHourIncidents.length >= config.analysis.minPatternOccurrences) {
      patterns.push({
        type: 'time',
        name: `Incidents at ${hourOfDay}:00`,
        description: `Multiple incidents occur around ${hourOfDay}:00`,
        signature: { hour: hourOfDay },
        incidents: sameHourIncidents.map(i => i.id),
        occurrences: sameHourIncidents.length,
        confidence: sameHourIncidents.length / recentIncidents.length
      });
    }
    
    if (incident.affectedServices?.length > 0) {
      const service = incident.affectedServices[0];
      const sameServiceIncidents = recentIncidents.filter(i =>
        i.affectedServices?.includes(service)
      );
      
      if (sameServiceIncidents.length >= config.analysis.minPatternOccurrences) {
        patterns.push({
          type: 'service',
          name: `${service} failures`,
          description: `Recurring issues with ${service}`,
          signature: { service },
          incidents: sameServiceIncidents.map(i => i.id),
          occurrences: sameServiceIncidents.length,
          confidence: sameServiceIncidents.length / recentIncidents.length
        });
      }
    }
    
    return patterns;
  }

  async gatherDataDogMetrics(startTime, endTime) {
    const cached = await cacheService.getCachedMetrics('datadog', startTime, endTime);
    if (cached) return cached;
    
    try {
      const [metrics, events, logs] = await Promise.all([
        datadogIntegration.getIncidentMetrics(startTime, endTime),
        datadogIntegration.getEvents(startTime, endTime),
        datadogIntegration.getLogs(startTime, endTime, 'status:error')
      ]);
      
      const result = {
        metrics,
        events,
        errorLogs: logs?.slice(0, 10),
        dashboardUrl: datadogIntegration.buildDashboardUrl('default', {
          from: startTime.getTime(),
          to: endTime.getTime()
        })
      };
      
      await cacheService.setCachedMetrics('datadog', startTime, endTime, result);
      return result;
    } catch (error) {
      logger.error('Failed to gather DataDog metrics:', error);
      return null;
    }
  }

  async gatherGrafanaData(startTime, endTime) {
    const cached = await cacheService.getCachedMetrics('grafana', startTime, endTime);
    if (cached) return cached;
    
    try {
      const [alerts, annotations] = await Promise.all([
        grafanaIntegration.getAlerts('alerting'),
        grafanaIntegration.getAnnotations(startTime, endTime)
      ]);
      
      const result = {
        activeAlerts: alerts,
        annotations,
        dashboardUrls: alerts.map(alert => 
          grafanaIntegration.buildDashboardUrl(alert.dashboardUid, startTime, endTime)
        )
      };
      
      await cacheService.setCachedMetrics('grafana', startTime, endTime, result);
      return result;
    } catch (error) {
      logger.error('Failed to gather Grafana data:', error);
      return null;
    }
  }

  async gatherHoneycombData(startTime, endTime) {
    try {
      const serviceMetrics = await honeycombIntegration.getServiceMetrics(
        'api-service',
        startTime,
        endTime
      );
      
      return {
        serviceMetrics,
        traceUrl: honeycombIntegration.buildTraceUrl('sample-trace-id')
      };
    } catch (error) {
      logger.error('Failed to gather Honeycomb data:', error);
      return null;
    }
  }

  async gatherArgoData(startTime, endTime) {
    try {
      const workflows = await argoIntegration.searchWorkflowsByTime(
        'default',
        startTime,
        endTime
      );
      
      return {
        failedWorkflows: workflows.filter(w => w.status?.phase === 'Failed'),
        runningWorkflows: workflows.filter(w => w.status?.phase === 'Running')
      };
    } catch (error) {
      logger.error('Failed to gather Argo data:', error);
      return null;
    }
  }

  async searchSlackForIncident(incidentId, startTime, endTime) {
    try {
      const messages = await slackIntegration.searchMessages(incidentId, {
        from: startTime.getTime(),
        to: endTime.getTime()
      });
      
      if (config.integrations.slack.incidentChannel) {
        const channelHistory = await slackIntegration.getChannelHistory(
          config.integrations.slack.incidentChannel,
          startTime.getTime() / 1000,
          endTime.getTime() / 1000
        );
        return [...messages, ...channelHistory];
      }
      
      return messages;
    } catch (error) {
      logger.error('Failed to search Slack:', error);
      return [];
    }
  }

  formatSlackMessages(messages) {
    if (!messages || messages.length === 0) return 'No Slack discussion found';
    
    return messages.map(msg => {
      const time = new Date(msg.ts * 1000).toISOString();
      return `[${time}] ${msg.username || msg.user}: ${msg.text}`;
    }).join('\n');
  }

  async postAnalysisResults(incidentId, summary, incidentData) {
    const promises = [];
    
    if (config.integrations.jira.enabled) {
      promises.push(
        jiraIntegration.addComment(incidentId, summary)
          .catch(error => logger.error('Failed to post to JIRA:', error))
      );
    }
    
    if (config.integrations.slack.enabled && config.integrations.slack.incidentChannel) {
      const jiraLink = `${config.integrations.jira.host}/browse/${incidentId}`;
      promises.push(
        slackIntegration.postIncidentSummary(
          config.integrations.slack.incidentChannel,
          summary.substring(0, 500),
          jiraLink
        ).catch(error => logger.error('Failed to post to Slack:', error))
      );
    }
    
    await Promise.allSettled(promises);
  }
}

export const incidentService = new IncidentService();
