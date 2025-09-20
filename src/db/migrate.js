import { sequelize } from './database.js';
import { Incident, Analysis, Pattern } from '../models/index.js';

async function migrate() {
  try {
    console.log('Starting database migration...');
    
    await sequelize.authenticate();
    console.log('Database connection established');
    
    await sequelize.sync({ force: false, alter: true });
    console.log('Database schema synchronized');
    
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
