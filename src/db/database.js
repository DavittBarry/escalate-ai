import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { logger } from '../index.js';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'escalateai',
  process.env.DB_USER || 'escalateai',
  process.env.DB_PASSWORD || 'localdev',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    logger.info('Database models synchronized');
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    throw error;
  }
}

export { sequelize };
