import dotenv from 'dotenv';

dotenv.config();

export const config = {
  app: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    webhookSecret: process.env.WEBHOOK_SECRET
  },
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'escalateai',
    user: process.env.DB_USER || 'escalateai',
    password: process.env.DB_PASSWORD || 'localdev'
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  },
  
  analysis: {
    timeWindowMinutes: parseInt(process.env.ANALYSIS_WINDOW || '60'),
    maxSimilarIncidents: parseInt(process.env.MAX_SIMILAR_INCIDENTS || '5'),
    enableAutoRemediation: process.env.AUTO_REMEDIATION === 'true',
    cacheTTLSeconds: parseInt(process.env.ANALYSIS_CACHE_TTL || '86400'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    retryDelayMs: parseInt(process.env.RETRY_DELAY || '5000'),
    enablePatternDetection: process.env.PATTERN_DETECTION !== 'false',
    minPatternOccurrences: parseInt(process.env.MIN_PATTERN_OCCURRENCES || '3')
  },
  
  ai: {
    provider: process.env.AI_PROVIDER || 'anthropic',
    model: process.env.AI_MODEL || 'claude-3-opus-20240229',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000'),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  
  integrations: {
    jira: {
      enabled: !!process.env.JIRA_HOST,
      host: process.env.JIRA_HOST,
      email: process.env.JIRA_EMAIL,
      apiToken: process.env.JIRA_API_TOKEN,
      projectKey: process.env.JIRA_PROJECT_KEY || 'INC'
    },
    
    datadog: {
      enabled: !!process.env.DATADOG_API_KEY,
      apiKey: process.env.DATADOG_API_KEY,
      appKey: process.env.DATADOG_APP_KEY,
      site: process.env.DATADOG_SITE || 'datadoghq.eu'
    },
    
    slack: {
      enabled: !!process.env.SLACK_BOT_TOKEN,
      botToken: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      incidentChannel: process.env.SLACK_INCIDENT_CHANNEL
    },
    
    teams: {
      enabled: !!process.env.TEAMS_APP_ID,
      appId: process.env.TEAMS_APP_ID,
      appPassword: process.env.TEAMS_APP_PASSWORD,
      tenantId: process.env.TEAMS_TENANT_ID,
      teamId: process.env.TEAMS_TEAM_ID,
      channelId: process.env.TEAMS_CHANNEL_ID
    },
    
    grafana: {
      enabled: !!process.env.GRAFANA_URL,
      url: process.env.GRAFANA_URL,
      apiKey: process.env.GRAFANA_API_KEY
    },
    
    honeycomb: {
      enabled: !!process.env.HONEYCOMB_API_KEY,
      apiKey: process.env.HONEYCOMB_API_KEY,
      dataset: process.env.HONEYCOMB_DATASET
    },
    
    argo: {
      enabled: !!process.env.ARGO_SERVER_URL,
      serverUrl: process.env.ARGO_SERVER_URL,
      token: process.env.ARGO_TOKEN
    }
  },
  
  rateLimits: {
    api: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
      max: parseInt(process.env.RATE_LIMIT_MAX || '10')
    },
    webhook: {
      windowMs: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW || '60000'),
      max: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX || '100')
    }
  },
  
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '2'),
    maxJobs: parseInt(process.env.QUEUE_MAX_JOBS || '100'),
    stalledInterval: parseInt(process.env.QUEUE_STALLED_INTERVAL || '30000')
  },
  
  monitoring: {
    metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    enableTracing: process.env.ENABLE_TRACING === 'true'
  }
};

export function getEnabledIntegrations() {
  return Object.entries(config.integrations)
    .filter(([_, integration]) => integration.enabled)
    .map(([name]) => name);
}

export function validateConfig() {
  const errors = [];
  
  if (!config.ai.apiKey) {
    errors.push('ANTHROPIC_API_KEY is required');
  }
  
  if (!config.app.webhookSecret && config.app.env === 'production') {
    errors.push('WEBHOOK_SECRET is required in production');
  }
  
  const enabledIntegrations = getEnabledIntegrations();
  if (enabledIntegrations.length === 0) {
    errors.push('At least one integration must be configured');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
