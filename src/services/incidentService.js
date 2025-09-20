import { claudeService } from './claudeService.js';
import { jiraIntegration } from '../integrations/jira.js';
import { datadogIntegration } from '../integrations/datadog.js';
import { grafanaIntegration } from '../integrations/grafana.js';
import { slackIntegration } from '../integrations/slack/slack.js';
import { teamsIntegration } from '../integrations/teams/teams.js';
import { honeycombIntegration } from '../integrations/honeycomb/honeycomb.js';
import { argoIntegration } from '../integrations/argo/argo.js';
import { logger } from '../index.js';
import PQueue from 'p-queue';

class IncidentService {
  constructor() {
    this.queue = new PQueue({ concurrency: 2 });
  }

  async analyzeIncident(incidentId, source = 'jira') {
    return this.queue.add(async () => {
      logger.info(`Starting analysis for incident ${incidentId}`);
      
      const incidentData = await this.gatherIncidentData(incidentId, source);
      
      const summary = await claudeService.generateIncidentSummary(incidentData);
      
      await this.postAnalysisResults(incidentId, summary, incidentData);
      
      return {
        incidentId,
        summary,
        timestamp: new Date().toISOString()
      };
    });
  }

  async gatherIncidentData(incidentId, source) {
    const data = {
      id: incidentId,
      source,
      timestamp: new Date().toISOString()
    };

    if (source === 'jira') {
      try {
        const issue = await jiraIntegration.getIssue(incidentId);
        data.title = issue.fields.summary;
        data.description = issue.fields.description;
        data.severity = issue.fields.priority?.name || 'Unknown';
        data.created = issue.fields.created;
        data.status = issue.fields.status?.name;
      } catch (error) {
        logger.error('Failed to get JIRA issue:', error);
      }
    }

    const startTime = new Date(data.created || Date.now() - 3600000);
    const endTime = new Date();
    
    const [
      datadogMetrics,
      grafanaAlerts,
      slackMessages,
      honeycombTraces,
      argoWorkflows
    ] = await Promise.all([
      this.gatherDataDogMetrics(startTime, endTime),
      this.gatherGrafanaData(startTime, endTime),
      this.searchSlackForIncident(incidentId, startTime, endTime),
      this.gatherHoneycombData(startTime, endTime),
      this.gatherArgoData(startTime, endTime)
    ]);

    data.metrics = { 
      datadog: datadogMetrics,
      grafana: grafanaAlerts
    };
    data.slackThread = this.formatSlackMessages(slackMessages);
    data.traces = honeycombTraces;
    data.argoStatus = argoWorkflows;
    
    if (process.env.TEAMS_TEAM_ID && process.env.TEAMS_CHANNEL_ID) {
      data.teamsMessages = await this.searchTeamsForIncident(incidentId, startTime, endTime);
    }
    
    const similarIncidents = await jiraIntegration.searchSimilarIncidents(
      data.title?.split(' ').slice(0, 3).join(' ') || ''
    );
    data.similarIncidents = similarIncidents;

    return data;
  }

  async gatherDataDogMetrics(startTime, endTime) {
    try {
      const [metrics, events, logs] = await Promise.all([
        datadogIntegration.getIncidentMetrics(startTime, endTime),
        datadogIntegration.getEvents(startTime, endTime),
        datadogIntegration.getLogs(startTime, endTime, 'status:error')
      ]);
      
      return {
        metrics,
        events,
        errorLogs: logs?.slice(0, 10),
        dashboardUrl: datadogIntegration.buildDashboardUrl('default', {
          from: startTime.getTime(),
          to: endTime.getTime()
        })
      };
    } catch (error) {
      logger.error('Failed to gather DataDog metrics:', error);
      return null;
    }
  }

  async gatherGrafanaData(startTime, endTime) {
    try {
      const [alerts, annotations] = await Promise.all([
        grafanaIntegration.getAlerts('alerting'),
        grafanaIntegration.getAnnotations(startTime, endTime)
      ]);
      
      return {
        activeAlerts: alerts,
        annotations,
        dashboardUrls: alerts.map(alert => 
          grafanaIntegration.buildDashboardUrl(alert.dashboardUid, startTime, endTime)
        )
      };
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
      
      if (process.env.SLACK_INCIDENT_CHANNEL) {
        const channelHistory = await slackIntegration.getChannelHistory(
          process.env.SLACK_INCIDENT_CHANNEL,
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

  async searchTeamsForIncident(incidentId, startTime, endTime) {
    try {
      const messages = await teamsIntegration.getChannelMessages(
        process.env.TEAMS_TEAM_ID,
        process.env.TEAMS_CHANNEL_ID,
        startTime,
        endTime
      );
      
      return messages
        .filter(msg => msg.body?.content?.includes(incidentId))
        .map(msg => `[${msg.createdDateTime}] ${msg.from?.user?.displayName}: ${msg.body?.content}`)
        .join('\n');
    } catch (error) {
      logger.error('Failed to search Teams:', error);
      return '';
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
    try {
      await jiraIntegration.addComment(incidentId, summary);
    } catch (error) {
      logger.error('Failed to post to JIRA:', error);
    }
    
    if (process.env.SLACK_INCIDENT_CHANNEL) {
      const jiraLink = `${process.env.JIRA_HOST}/browse/${incidentId}`;
      await slackIntegration.postIncidentSummary(
        process.env.SLACK_INCIDENT_CHANNEL,
        summary.substring(0, 500),
        jiraLink
      );
    }
    
    if (process.env.TEAMS_TEAM_ID && process.env.TEAMS_CHANNEL_ID) {
      const jiraLink = `${process.env.JIRA_HOST}/browse/${incidentId}`;
      await teamsIntegration.postIncidentCard(
        process.env.TEAMS_TEAM_ID,
        process.env.TEAMS_CHANNEL_ID,
        {
          id: incidentId,
          title: incidentData.title,
          severity: incidentData.severity,
          status: incidentData.status,
          summary: summary.substring(0, 500)
        },
        jiraLink
      );
    }
    
    if (incidentData.similarIncidents?.length > 0) {
      for (const similar of incidentData.similarIncidents.slice(0, 3)) {
        await jiraIntegration.linkIssues(incidentId, similar.key, 'Relates');
      }
    }
  }
}

export const incidentService = new IncidentService();
