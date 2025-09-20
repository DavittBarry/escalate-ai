import { DataTypes } from 'sequelize';
import { sequelize } from '../db/database.js';

const Pattern = sequelize.define('Pattern', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('time', 'service', 'error', 'deployment', 'dependency'),
    allowNull: false
  },
  signature: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Pattern matching criteria'
  },
  incidents: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    comment: 'List of incident IDs matching this pattern'
  },
  occurrences: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastOccurred: {
    type: DataTypes.DATE,
    allowNull: true
  },
  avgMttr: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Average MTTR in minutes'
  },
  recommendedActions: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  autoRemediationEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  confidence: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0.0,
    comment: 'Pattern confidence score'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['type'] },
    { fields: ['occurrences'] },
    { fields: ['lastOccurred'] }
  ]
});

export default Pattern;
