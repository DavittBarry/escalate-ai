# EscalateAI

AI-powered incident documentation and analysis tool.

## Features

- **Automatic Incident Analysis**: Gathers data from DataDog, Grafana, Slack, Teams, Jira, Argo, and Honeycomb
- **AI-Powered Summaries**: Uses Claude to generate executive summaries and technical post-mortems
- **JIRA Integration**: Automatically posts analysis as comments on incident tickets
- **Pattern Recognition**: Links similar past incidents for faster resolution
- **Multi-Source Correlation**: Combines metrics, logs, traces, and team discussions

## Setup

1. Clone and install:
```bash
cd escalate-ai
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. Run locally:
```bash
npm run dev
```

4. Or use Docker:
```bash
docker-compose up
```

## Integration Points

- **JIRA Webhook**: `/webhooks/jira` - Triggers on incident creation
- **DataDog Webhook**: `/webhooks/datadog` - Receives alerts
- **Slack Events**: `/webhooks/slack` - Monitors incident discussions
- **API Endpoint**: `/api/analyze-incident` - Manual trigger

## How It Works

1. **Incident Created** in JIRA (type: Incident)
2. **EscalateAI Triggered** via webhook
3. **Data Collection** from all integrated tools:
   - DataDog metrics for the incident timeframe
   - Grafana alerts and dashboards
   - Slack/Teams discussions mentioning the incident
   - Honeycomb traces for affected services
   - Argo workflow status
4. **Claude Analysis** generates comprehensive summary
5. **Results Posted** to JIRA as comment with:
   - Executive summary with business impact
   - Technical root cause analysis
   - Timeline with linked evidence
   - Similar past incidents
   - Prevention recommendations

## Testing

```bash
# Test webhook endpoint
curl -X POST http://localhost:3000/api/analyze-incident \
  -H "Content-Type: application/json" \
  -d '{"incidentId": "INC-123", "source": "jira"}'

# Health check
curl http://localhost:3000/health
```

## Next Steps

- [ ] Add Grafana integration
- [ ] Add Honeycomb integration  
- [ ] Add Teams integration
- [ ] Add Argo integration
- [ ] Implement post-mortem generation
- [ ] Add incident timeline visualization
- [ ] Build web UI for configuration
