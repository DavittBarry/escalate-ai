import axios from 'axios';
import { logger } from '../index.js';

class GrafanaIntegration {
  constructor() {
    this.baseUrl = process.env.GRAFANA_URL;
    this.apiKey = process.env.GRAFANA_API_KEY;
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async getAlerts(state = 'alerting') {
    try {
      const response = await axios.get(`${this.baseUrl}/api/alerts`, {
        headers: this.headers,
        params: { state }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get Grafana alerts:', error);
      return [];
    }
  }

  async getAlertHistory(alertId, from, to) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/annotations`,
        {
          headers: this.headers,
          params: {
            alertId,
            from: from.getTime(),
            to: to.getTime()
          }
        }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to get alert history:', error);
      return [];
    }
  }

  async getDashboard(uid) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/dashboards/uid/${uid}`,
        { headers: this.headers }
      );
      return response.data.dashboard;
    } catch (error) {
      logger.error('Failed to get dashboard:', error);
      return null;
    }
  }

  async queryMetrics(datasourceId, query, from, to) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/ds/query`,
        {
          queries: [{
            datasourceId,
            expr: query,
            interval: '30s',
            refId: 'A'
          }],
          from: from.toISOString(),
          to: to.toISOString()
        },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to query metrics:', error);
      return null;
    }
  }

  buildDashboardUrl(dashboardUid, from, to, panelId = null) {
    let url = `${this.baseUrl}/d/${dashboardUid}?from=${from.getTime()}&to=${to.getTime()}`;
    if (panelId) {
      url += `&viewPanel=${panelId}`;
    }
    return url;
  }

  async getAnnotations(from, to, tags = []) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/annotations`, {
        headers: this.headers,
        params: {
          from: from.getTime(),
          to: to.getTime(),
          tags: tags.join(',')
        }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get annotations:', error);
      return [];
    }
  }
}

export const grafanaIntegration = new GrafanaIntegration();
