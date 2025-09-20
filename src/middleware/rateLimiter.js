import rateLimit from 'express-rate-limit';
import { config } from '../config/config.js';

export const apiLimiter = rateLimit({
  windowMs: config.rateLimits.api.windowMs,
  max: config.rateLimits.api.max,
  message: 'Too many analysis requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests from this IP',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

export const webhookLimiter = rateLimit({
  windowMs: config.rateLimits.webhook.windowMs,
  max: config.rateLimits.webhook.max,
  message: 'Too many webhook requests',
  standardHeaders: true,
  legacyHeaders: false
});

export const createCustomLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false
  });
};
