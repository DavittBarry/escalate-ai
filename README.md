# EscalateAI

AI-powered incident documentation and analysis tool with advanced pattern detection and caching.

## Features

### Core Capabilities
- **Automatic Incident Analysis**: Gathers data from DataDog, Grafana, Slack, Teams, Jira, Argo, and Honeycomb
- **AI-Powered Summaries**: Uses Claude to generate executive summaries and technical post-mortems
- **Pattern Detection**: Automatically identifies recurring issues and trends
- **Smart Caching**: Redis-based caching for faster responses and reduced API costs
- **Queue Management**: Bull queue system for reliable job processing
- **Real-time Updates**: WebSocket support for live incident updates

### Data Persistence
- PostgreSQL database for incident history
- Analysis tracking with cost monitoring
- Pattern recognition across incidents
- MTTR (Mean Time To Resolution) tracking

### Enterprise Features
- Rate limiting for API protection
- Comprehensive error handling and retry logic
- Health checks and metrics endpoints
- Graceful shutdown handling
- Multi-tenant support ready

## Setup

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### Installation

1. Clone and install dependencies:
```bash
cd escalate-ai
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. Set up database:
```bash
docker-compose up -d postgres redis
npm run db:migrate
```

4. Start development server:
```bash
npm run dev
# Or use the helper script
./start-dev.bat  # Windows
./start-dev.sh   # Linux/Mac
```

## API Endpoints

### Analysis
- `POST /api/analyze-incident` - Trigger incident analysis
- `GET /api/incidents` - List incidents with filtering
- `GET /api/incidents/:id` - Get specific incident details
- `PATCH /api/incidents/:id` - Update incident
- `POST /api/incidents/:id/reanalyze` - Force reanalysis

### Patterns & Stats
- `GET /api/patterns` - Get detected patterns
- `GET /api/stats` - Get system statistics
- `GET /api/queue-stats` - Queue status

### Webhooks
- `POST /webhooks/jira` - JIRA incident webhook
- `POST /webhooks/datadog` - DataDog alerts
- `POST /webhooks/slack` - Slack events
- `POST /webhooks/grafana` - Grafana alerts

### Admin
- `POST /api/queue/:name/pause` - Pause queue
- `POST /api/queue/:name/resume` - Resume queue
- `POST /api/cache/invalidate/:id` - Clear cache

## Configuration

### Key Environment Variables

```env
# AI Configuration
ANTHROPIC_API_KEY=        # Required
AI_MAX_TOKENS=2000       # Token limit
AI_TEMPERATURE=0.3       # Response creativity

# Analysis Settings
ANALYSIS_WINDOW=60       # Minutes to analyze
MAX_SIMILAR_INCIDENTS=5  # Related incidents
PATTERN_DETECTION=true   # Enable patterns

# Performance
QUEUE_CONCURRENCY=2      # Parallel jobs
RATE_LIMIT_MAX=10       # Requests per window
ANALYSIS_CACHE_TTL=86400 # Cache duration
```

## Architecture

```
┌─────────────┐     ┌──────────┐     ┌──────────┐
│  Webhooks   │────▶│  Queue   │────▶│ Analysis │
└─────────────┘     └──────────┘     └──────────┘
                           │                │
                           ▼                ▼
                    ┌──────────┐     ┌──────────┐
                    │  Redis   │     │ Database │
                    └──────────┘     └──────────┘
```

## Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Metrics (Prometheus format)
```bash
curl http://localhost:3000/metrics
```

### Queue Status
```bash
curl http://localhost:3000/api/queue-stats
```

## Testing

```bash
# Run API tests
npm run test:api

# Test specific endpoint
curl -X POST http://localhost:3000/api/analyze-incident \
  -H "Content-Type: application/json" \
  -d '{"incidentId": "INC-123", "source": "jira"}'
```

## WebSocket Events

Connect to receive real-time updates:

```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  socket.emit('subscribe-incident', 'INC-123');
});

socket.on('incident-update', (data) => {
  console.log('Incident updated:', data);
});
```

## Database Schema

### Incidents Table
- Stores all incident data
- Tracks analysis count and MTTR
- Links to similar incidents

### Analysis Table
- Individual analysis runs
- Token usage and costs
- Performance metrics

### Patterns Table
- Detected recurring issues
- Confidence scores
- Recommended actions

## Performance Optimizations

1. **Caching Strategy**
   - 24-hour cache for analyses
   - 5-minute cache for metrics
   - Lock mechanism prevents duplicate work

2. **Queue Management**
   - Priority queues for P1/P2 incidents
   - Exponential backoff for retries
   - Dead letter queue for failures

3. **Database Indexes**
   - Optimized for common queries
   - Composite indexes on search fields

## Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure strong `WEBHOOK_SECRET`
- [ ] Enable HTTPS with reverse proxy
- [ ] Set up database backups
- [ ] Configure monitoring alerts
- [ ] Review rate limits
- [ ] Enable distributed tracing

### Docker Deployment
```bash
docker build -t escalate-ai .
docker-compose -f docker-compose.prod.yml up
```

## Roadmap

- [ ] Web dashboard UI
- [ ] Auto-remediation execution
- [ ] ML-based root cause prediction
- [ ] Cost optimization recommendations
- [ ] Runbook generation
- [ ] PagerDuty integration
- [ ] Kubernetes operator

## License

MIT

## Support

For issues or questions, please open a GitHub issue.
