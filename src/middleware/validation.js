import Joi from 'joi';
import { AppError } from './errorHandler.js';

const schemas = {
  analyzeIncident: Joi.object({
    incidentId: Joi.string().required().min(1).max(100),
    source: Joi.string().valid('jira', 'manual', 'api').default('jira'),
    force: Joi.boolean().default(false),
    priority: Joi.string().valid('P1', 'P2', 'P3', 'P4').optional()
  }),
  
  jiraWebhook: Joi.object({
    webhookEvent: Joi.string().required(),
    issue: Joi.object({
      key: Joi.string().required(),
      fields: Joi.object().required()
    }).required()
  }),
  
  searchIncidents: Joi.object({
    query: Joi.string().optional(),
    severity: Joi.string().valid('P1', 'P2', 'P3', 'P4').optional(),
    status: Joi.string().valid('open', 'investigating', 'resolved', 'closed').optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    limit: Joi.number().min(1).max(100).default(10),
    offset: Joi.number().min(0).default(0)
  })
};

export const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next(new AppError('Invalid validation schema', 500));
    }
    
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(message, 400));
    }
    
    req.validatedBody = value;
    next();
  };
};

export const validateQuery = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next(new AppError('Invalid validation schema', 500));
    }
    
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(message, 400));
    }
    
    req.validatedQuery = value;
    next();
  };
};
