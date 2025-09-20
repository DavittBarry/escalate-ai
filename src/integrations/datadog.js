import axios from 'axios';
import { logger } from '../index.js';

class DataDogIntegration {
  constructor() {
    this.apiKey = process.env.DATADOG_API_KEY;
    this.appKey = process.env.DATADOG_APP_KEY;
    this.site = process.env.DATADOG_SITE || 'datadoghq.eu';
    this.baseUrl = `https://api.${this.site}/api/v1`;
  }

  async getIncidentMetrics(startTime, endTime, query) {
    try {
      const response = await axios.get(`${this.baseUrl}/query`, {
        headers: {
          'DD-API-KEY': this.apiKey,
          'DD-APPLICATION-KEY': this.appKey
        },
        params: {
          from: Math.floor(startTime / 1000),
          to: Math.floor(endTime / 1000),
          query: query || 'avg:system.cpu.user{*}'
        }
      });
      return response.data;
    } catch (error) {
      logger.error('DataDog API error:', error);
      return null;
    }
  }

  async getMonitorStatus(monitorId) {
    try {
      const response = await axios.get(`${this.baseUrl}/monitor/${monitorId}`, {
        headers: {
          'DD-API-KEY': this.apiKey,
          'DD-APPLICATION-KEY': this.appKey
        }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get monitor status:', error);
      return null;
    }
  }

  async getEvents(startTime, endTime, tags = []) {
    try {
      const response = await axios.get(`${this.baseUrl}/events`, {
        headers: {
          'DD-API-KEY': this.apiKey,
          'DD-APPLICATION-KEY': this.appKey
        },
        params: {
          start: Math.floor(startTime / 1000),
          end: Math.floor(endTime / 1000),
          tags: tags.join(',')
        }
      });
      return response.data.events;
    } catch (error) {
      logger.error('Failed to get DataDog events:', error);
      return [];
    }
  }

  buildDashboardUrl(dashboardId, timeRange) {
    return `https://app.${this.site}/dashboard/${dashboardId}?from_ts=${timeRange.from}&to_ts=${timeRange.to}`;
  }

  async getLogs(startTime, endTime, query) {
    try {
      const response = await axios.post(
        `https://api.${this.site}/api/v2/logs/events/search`,
        {
          filter: {
            from: startTime.toISOString(),
            to: endTime.toISOString(),
            query: query || '*'
          },
          page: { limit: 100 }
        },
        {
          headers: {
            'DD-API-KEY': this.apiKey,
            'DD-APPLICATION-KEY': this.appKey
          }
        }
      );
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get DataDog logs:', error);
      return [];
    }
  }
}

export const datadogIntegration = new DataDogIntegration();
