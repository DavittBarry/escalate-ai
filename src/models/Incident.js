import { DataTypes } from 'sequelize';
import { sequelize } from '../db/database.js';

const Incident = sequelize.define('Incident', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  severity: {
    type: DataTypes.ENUM('P1', 'P2', 'P3', 'P4', 'Unknown'),
    defaultValue: 'Unknown'
  },
  status: {
    type: DataTypes.ENUM('open', 'investigating', 'resolved', 'closed'),
    defaultValue: 'open'
  },
  source: {
    type: DataTypes.STRING,
    defaultValue: 'jira'
  },
  analysis: {
    type: DataTypes.JSON,
    allowNull: true
  },
  aiSummary: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metrics: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  traces: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  slackThread: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  teamsMessages: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  rootCause: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  customerImpact: {
    type: DataTypes.JSON,
    allowNull: true
  },
  remediationSteps: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  similarIncidents: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  mttr: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Mean Time To Resolution in minutes'
  },
  affectedServices: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  costEstimate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Estimated business impact cost'
  },
  analysisCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of times AI analysis was run'
  },
  lastAnalyzedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['severity'] },
    { fields: ['status'] },
    { fields: ['createdAt'] },
    { fields: ['affectedServices'] },
    { fields: ['tags'] }
  ]
});

export default Incident;
