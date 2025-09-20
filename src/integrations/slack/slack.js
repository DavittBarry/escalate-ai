import { WebClient } from '@slack/web-api';
import { logger } from '../../index.js';

class SlackIntegration {
  constructor() {
    this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
  }

  async getThreadMessages(channelId, threadTs) {
    try {
      const result = await this.client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        limit: 100
      });
      return result.messages;
    } catch (error) {
      logger.error('Failed to get Slack thread:', error);
      return [];
    }
  }

  async searchMessages(query, timeRange) {
    try {
      const result = await this.client.search.messages({
        query: query,
        sort: 'timestamp',
        sort_dir: 'desc'
      });
      return result.messages.matches;
    } catch (error) {
      logger.error('Failed to search Slack:', error);
      return [];
    }
  }

  async postMessage(channel, text, blocks = null) {
    try {
      const message = {
        channel: channel,
        text: text
      };
      
      if (blocks) {
        message.blocks = blocks;
      }
      
      await this.client.chat.postMessage(message);
      logger.info(`Posted message to Slack channel ${channel}`);
    } catch (error) {
      logger.error('Failed to post to Slack:', error);
    }
  }

  async postIncidentSummary(channel, summary, incidentLink) {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🤖 Incident Analysis Complete'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: summary
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View in JIRA'
            },
            url: incidentLink
          }
        ]
      }
    ];
    
    await this.postMessage(channel, 'Incident analysis complete', blocks);
  }

  async getChannelHistory(channelId, oldest, latest) {
    try {
      const result = await this.client.conversations.history({
        channel: channelId,
        oldest: oldest,
        latest: latest,
        limit: 1000
      });
      return result.messages;
    } catch (error) {
      logger.error('Failed to get channel history:', error);
      return [];
    }
  }
}

export const slackIntegration = new SlackIntegration();
