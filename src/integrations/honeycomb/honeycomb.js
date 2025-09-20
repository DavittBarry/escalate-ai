import axios from 'axios';
import { logger } from '../../index.js';

class HoneycombIntegration {
  constructor() {
    this.apiKey = process.env.HONEYCOMB_API_KEY;
    this.dataset = process.env.HONEYCOMB_DATASET;
    this.baseUrl = 'https://api.honeycomb.io/1';
    this.headers = {
      'X-Honeycomb-Team': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  async queryData(query, startTime, endTime) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/queries/${this.dataset}`,
        {
          query_json: {
            time_range: {
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString()
            },
            granularity: 60,
            ...query
          }
        },
        { headers: this.headers }
      );
      
      const queryId = response.data.id;
      return await this.getQueryResults(queryId);
    } catch (error) {
      logger.error('Failed to query Honeycomb:', error);
      return null;
    }
  }

  async getQueryResults(queryId) {
    try {
      let attempts = 0;
      while (attempts < 10) {
        const response = await axios.get(
          `${this.baseUrl}/queries/${this.dataset}/${queryId}`,
          { headers: this.headers }
        );
        
        if (response.data.complete) {
          return response.data.results;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      return null;
    } catch (error) {
      logger.error('Failed to get query results:', error);
      return null;
    }
  }

  async getTraces(traceId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/traces/${this.dataset}/${traceId}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to get trace:', error);
      return null;
    }
  }

  async searchTraces(serviceName, startTime, endTime, filters = {}) {
    const query = {
      breakdowns: ['trace.trace_id'],
      filters: [
        { column: 'service_name', op: '=', value: serviceName },
        ...Object.entries(filters).map(([key, value]) => ({
          column: key,
          op: '=',
          value
        }))
      ],
      calculations: [
        { op: 'COUNT' },
        { column: 'duration_ms', op: 'P95' }
      ]
    };

    return await this.queryData(query, startTime, endTime);
  }

  buildTraceUrl(traceId) {
    return `https://ui.honeycomb.io/${this.dataset}/trace/${traceId}`;
  }

  async getServiceMetrics(serviceName, startTime, endTime) {
    const query = {
      breakdowns: ['timestamp'],
      filters: [
        { column: 'service_name', op: '=', value: serviceName }
      ],
      calculations: [
        { op: 'COUNT' },
        { column: 'duration_ms', op: 'P50' },
        { column: 'duration_ms', op: 'P95' },
        { column: 'duration_ms', op: 'P99' },
        { column: 'error', op: 'COUNT', if: { column: 'error', op: 'exists' } }
      ]
    };

    return await this.queryData(query, startTime, endTime);
  }
}

export const honeycombIntegration = new HoneycombIntegration();
