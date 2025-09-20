import Incident from './Incident.js';
import Analysis from './Analysis.js';
import Pattern from './Pattern.js';

Incident.hasMany(Analysis, {
  foreignKey: 'incidentId',
  as: 'analyses'
});

Analysis.belongsTo(Incident, {
  foreignKey: 'incidentId',
  as: 'incident'
});

export {
  Incident,
  Analysis,
  Pattern
};
