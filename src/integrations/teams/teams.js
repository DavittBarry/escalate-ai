import axios from 'axios';
import { logger } from '../../index.js';

class TeamsIntegration {
  constructor() {
    this.appId = process.env.TEAMS_APP_ID;
    this.appPassword = process.env.TEAMS_APP_PASSWORD;
    this.tenantId = process.env.TEAMS_TENANT_ID;
    this.baseUrl = 'https://graph.microsoft.com/v1.0';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: this.appId,
          client_secret: this.appPassword,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials'
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to get Teams access token:', error);
      throw error;
    }
  }

  async searchMessages(query, teamId, channelId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `${this.baseUrl}/teams/${teamId}/channels/${channelId}/messages`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          params: {
            '$search': query,
            '$top': 50
          }
        }
      );
      return response.data.value;
    } catch (error) {
      logger.error('Failed to search Teams messages:', error);
      return [];
    }
  }

  async postMessage(teamId, channelId, message) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.post(
        `${this.baseUrl}/teams/${teamId}/channels/${channelId}/messages`,
        {
          body: {
            contentType: 'html',
            content: message
          }
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      logger.info('Posted message to Teams');
      return response.data;
    } catch (error) {
      logger.error('Failed to post to Teams:', error);
      throw error;
    }
  }

  async postIncidentCard(teamId, channelId, incidentData, jiraLink) {
    const card = {
      type: 'AdaptiveCard',
      body: [
        {
          type: 'TextBlock',
          size: 'Large',
          weight: 'Bolder',
          text: '🤖 Incident Analysis Complete'
        },
        {
          type: 'TextBlock',
          text: incidentData.title,
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Incident ID', value: incidentData.id },
            { title: 'Severity', value: incidentData.severity },
            { title: 'Status', value: incidentData.status || 'Analyzing' }
          ]
        },
        {
          type: 'TextBlock',
          text: incidentData.summary,
          wrap: true,
          maxLines: 5
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'View in JIRA',
          url: jiraLink
        }
      ],
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.2'
    };

    const message = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: card
        }
      ]
    };

    return await this.postMessage(teamId, channelId, message);
  }

  async getChannelMessages(teamId, channelId, startTime, endTime) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `${this.baseUrl}/teams/${teamId}/channels/${channelId}/messages/delta`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          params: {
            '$filter': `createdDateTime ge ${startTime.toISOString()} and createdDateTime le ${endTime.toISOString()}`
          }
        }
      );
      return response.data.value;
    } catch (error) {
      logger.error('Failed to get channel messages:', error);
      return [];
    }
  }
}

export const teamsIntegration = new TeamsIntegration();
