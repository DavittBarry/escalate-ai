import axios from 'axios';

const baseUrl = 'http://localhost:3000';

async function testEndpoints() {
  console.log('Testing EscalateAI endpoints...\n');

  try {
    console.log('1. Testing health endpoint...');
    const health = await axios.get(`${baseUrl}/health`);
    console.log('✅ Health check:', health.data);

    console.log('\n2. Testing manual analysis endpoint...');
    const analysis = await axios.post(`${baseUrl}/api/analyze-incident`, {
      incidentId: 'TEST-123',
      source: 'jira'
    });
    console.log('✅ Analysis triggered:', analysis.data);

    console.log('\n3. Testing JIRA webhook...');
    const jiraWebhook = await axios.post(`${baseUrl}/webhooks/jira`, {
      webhookEvent: 'jira:issue_created',
      issue: {
        key: 'INC-456',
        fields: {
          issuetype: { name: 'Incident' },
          summary: 'Test incident for verification',
          priority: { name: 'P2' },
          created: new Date().toISOString()
        }
      }
    });
    console.log('✅ JIRA webhook:', jiraWebhook.data);

    console.log('\n4. Testing DataDog webhook...');
    const ddWebhook = await axios.post(`${baseUrl}/webhooks/datadog`, {
      alert_type: 'alert',
      alert_title: 'High CPU Usage',
      event_msg: 'CPU usage above 90% for 5 minutes'
    });
    console.log('✅ DataDog webhook:', ddWebhook.data);

    console.log('\n5. Testing Slack webhook...');
    const slackWebhook = await axios.post(`${baseUrl}/webhooks/slack`, {
      type: 'event_callback',
      event: {
        type: 'message',
        text: 'There seems to be an incident with the payment service'
      }
    });
    console.log('✅ Slack webhook:', slackWebhook.data);

    console.log('\n✨ All tests passed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('Make sure the server is running on port 3000');
  }
}

console.log('===========================================');
console.log('EscalateAI API Test Suite');
console.log('===========================================\n');
console.log('Make sure to run "npm run dev" first!\n');

setTimeout(() => {
  testEndpoints();
}, 2000);
