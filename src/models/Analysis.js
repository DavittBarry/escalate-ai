import { DataTypes } from 'sequelize';
import { sequelize } from '../db/database.js';

const Analysis = sequelize.define('Analysis', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  incidentId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'Incidents',
      key: 'id'
    }
  },
  model: {
    type: DataTypes.STRING,
    defaultValue: 'claude-3-opus-20240229'
  },
  promptTokens: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  completionTokens: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  totalTokens: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  cost: {
    type: DataTypes.DECIMAL(10, 6),
    allowNull: true,
    comment: 'Cost in USD'
  },
  duration: {
    type: DataTypes.INTEGER,
    comment: 'Analysis duration in milliseconds'
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  fullAnalysis: {
    type: DataTypes.JSON,
    allowNull: true
  },
  confidence: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    comment: 'Confidence score 0.00-1.00'
  },
  dataSources: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Which integrations provided data'
  },
  errors: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Any errors during analysis'
  },
  triggeredBy: {
    type: DataTypes.STRING,
    defaultValue: 'webhook'
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending'
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['incidentId'] },
    { fields: ['createdAt'] },
    { fields: ['status'] }
  ]
});

export default Analysis;
