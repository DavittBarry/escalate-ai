import JiraClient from 'jira-client';
import { logger } from '../index.js';

class JiraIntegration {
  constructor() {
    this.client = new JiraClient({
      protocol: 'https',
      host: process.env.JIRA_HOST?.replace('https://', ''),
      username: process.env.JIRA_EMAIL,
      password: process.env.JIRA_API_TOKEN,
      apiVersion: '3',
      strictSSL: true
    });
  }

  async getIssue(issueKey) {
    try {
      return await this.client.findIssue(issueKey);
    } catch (error) {
      logger.error(`Failed to get JIRA issue ${issueKey}:`, error);
      throw error;
    }
  }

  async addComment(issueKey, comment) {
    try {
      await this.client.addComment(issueKey, comment);
      logger.info(`Added comment to ${issueKey}`);
    } catch (error) {
      logger.error(`Failed to add comment to ${issueKey}:`, error);
      throw error;
    }
  }

  async updateIssue(issueKey, updates) {
    try {
      await this.client.updateIssue(issueKey, updates);
      logger.info(`Updated issue ${issueKey}`);
    } catch (error) {
      logger.error(`Failed to update ${issueKey}:`, error);
      throw error;
    }
  }

  async linkIssues(inwardIssue, outwardIssue, linkType = 'Relates') {
    try {
      await this.client.issueLink({
        type: { name: linkType },
        inwardIssue: { key: inwardIssue },
        outwardIssue: { key: outwardIssue }
      });
      logger.info(`Linked ${inwardIssue} to ${outwardIssue}`);
    } catch (error) {
      logger.error('Failed to link issues:', error);
    }
  }

  async searchSimilarIncidents(keywords, projectKey = 'INC') {
    const jql = `project = ${projectKey} AND text ~ "${keywords}" ORDER BY created DESC`;
    try {
      const results = await this.client.searchJira(jql, {
        maxResults: 5,
        fields: ['key', 'summary', 'created', 'resolution']
      });
      return results.issues;
    } catch (error) {
      logger.error('Failed to search similar incidents:', error);
      return [];
    }
  }
}

export const jiraIntegration = new JiraIntegration();
