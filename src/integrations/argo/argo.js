import axios from 'axios';
import { logger } from '../../index.js';

class ArgoIntegration {
  constructor() {
    this.serverUrl = process.env.ARGO_SERVER_URL;
    this.token = process.env.ARGO_TOKEN;
    this.headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  async getWorkflow(namespace, name) {
    try {
      const response = await axios.get(
        `${this.serverUrl}/api/v1/workflows/${namespace}/${name}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to get Argo workflow:', error);
      return null;
    }
  }

  async listWorkflows(namespace, labels = {}) {
    try {
      const labelSelector = Object.entries(labels)
        .map(([key, value]) => `${key}=${value}`)
        .join(',');
      
      const response = await axios.get(
        `${this.serverUrl}/api/v1/workflows/${namespace}`,
        {
          headers: this.headers,
          params: { labelSelector }
        }
      );
      return response.data.items || [];
    } catch (error) {
      logger.error('Failed to list workflows:', error);
      return [];
    }
  }

  async getWorkflowLogs(namespace, name, podName, container) {
    try {
      const response = await axios.get(
        `${this.serverUrl}/api/v1/workflows/${namespace}/${name}/${podName}/log`,
        {
          headers: this.headers,
          params: { container }
        }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to get workflow logs:', error);
      return null;
    }
  }

  async getWorkflowEvents(namespace, name) {
    try {
      const response = await axios.get(
        `${this.serverUrl}/api/v1/stream/events/${namespace}`,
        {
          headers: this.headers,
          params: {
            listOptions: {
              fieldSelector: `involvedObject.name=${name}`
            }
          }
        }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to get workflow events:', error);
      return [];
    }
  }

  async getWorkflowStatus(namespace, name) {
    const workflow = await this.getWorkflow(namespace, name);
    if (!workflow) return null;

    return {
      phase: workflow.status.phase,
      startedAt: workflow.status.startedAt,
      finishedAt: workflow.status.finishedAt,
      duration: workflow.status.duration,
      nodes: Object.values(workflow.status.nodes || {}).map(node => ({
        name: node.name,
        phase: node.phase,
        type: node.type,
        startedAt: node.startedAt,
        finishedAt: node.finishedAt,
        message: node.message
      }))
    };
  }

  buildWorkflowUrl(namespace, name) {
    return `${this.serverUrl}/workflows/${namespace}/${name}`;
  }

  async searchWorkflowsByTime(namespace, startTime, endTime) {
    try {
      const workflows = await this.listWorkflows(namespace);
      
      return workflows.filter(workflow => {
        const createdAt = new Date(workflow.metadata.creationTimestamp);
        return createdAt >= startTime && createdAt <= endTime;
      });
    } catch (error) {
      logger.error('Failed to search workflows by time:', error);
      return [];
    }
  }
}

export const argoIntegration = new ArgoIntegration();
