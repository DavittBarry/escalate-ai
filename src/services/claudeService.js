import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../index.js';

class ClaudeService {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateIncidentSummary(incidentData) {
    try {
      const prompt = this.buildIncidentPrompt(incidentData);
      
      const message = await this.client.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return message.content[0].text;
    } catch (error) {
      logger.error('Claude API error:', error);
      throw error;
    }
  }

  buildIncidentPrompt(data) {
    return `Analyze this incident and provide a structured summary for JIRA:

Incident Data:
- Title: ${data.title}
- Time: ${data.startTime} to ${data.endTime || 'ongoing'}
- Severity: ${data.severity}

DataDog Metrics:
${JSON.stringify(data.metrics?.datadog || {}, null, 2)}

Grafana Alerts:
${JSON.stringify(data.metrics?.grafana || {}, null, 2)}

Honeycomb Traces:
${JSON.stringify(data.traces || {}, null, 2)}

Slack Discussion:
${data.slackThread || 'No discussion captured'}

Teams Messages:
${data.teamsMessages || 'No messages captured'}

Argo Workflow Status:
${JSON.stringify(data.argoStatus || {}, null, 2)}

Please provide:
1. Executive Summary (2-3 sentences, business impact focus)
2. Technical Root Cause Analysis
3. Timeline of Events
4. Affected Services
5. Customer Impact Assessment
6. Remediation Steps Taken
7. Prevention Recommendations
8. Links to relevant dashboards and logs

Format as markdown for JIRA comment.`;
  }

  async generatePostMortem(incidentData) {
    const prompt = `Create a detailed post-mortem document based on the following incident data...`;
    
    const message = await this.client.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return message.content[0].text;
  }
}

export const claudeService = new ClaudeService();
