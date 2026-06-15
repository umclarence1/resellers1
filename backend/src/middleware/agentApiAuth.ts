import { Response, NextFunction } from 'express';
import { User } from '../models/User';
import { ApiLog } from '../models/ApiLog';
import { AppError } from './errorHandler';
import { AuthRequest } from './auth';
import { migrateAgentSecretIfNeeded, verifyAgentSecret } from '../services/agentSecretService';

export interface AgentApiRequest extends AuthRequest {
  agentId?: string;
  apiStartTime?: number;
}

function resolveClientIp(req: AgentApiRequest): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim();
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
}

export const agentApiAuth = async (
  req: AgentApiRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  req.apiStartTime = Date.now();

  const apiKey = req.headers['x-api-key'] as string;
  const secretKey = req.headers['x-secret-key'] as string;

  if (!apiKey || !secretKey) {
    throw new AppError('API key and secret key required', 401);
  }

  const agent = await User.findOne({
    role: 'agent',
    'agentApi.apiKey': apiKey,
    'agentApi.isActive': true,
    status: 'active',
  })
    .select('+agentApi.secretKey +agentApi.secretKeyHash')
    .exec();

  if (!agent?.agentApi) {
    throw new AppError('Invalid API credentials', 401);
  }

  const valid = await verifyAgentSecret(
    secretKey,
    agent.agentApi.secretKeyHash,
    agent.agentApi.secretKey
  );

  if (!valid) {
    throw new AppError('Invalid API credentials', 401);
  }

  if (agent.agentApi.secretKey && !agent.agentApi.secretKeyHash) {
    await migrateAgentSecretIfNeeded(agent);
  }

  const clientIp = resolveClientIp(req);
  const whitelist = agent.agentApi?.ipWhitelist || [];

  if (whitelist.length > 0 && !whitelist.includes(clientIp)) {
    throw new AppError('IP address not whitelisted', 403);
  }

  req.user = agent;
  req.agentId = agent._id.toString();

  res.on('finish', () => {
    const responseTime = Date.now() - (req.apiStartTime || Date.now());
    ApiLog.create({
      agentId: agent._id,
      endpoint: req.originalUrl,
      method: req.method,
      statusCode: res.statusCode,
      ip: clientIp,
      requestBody: req.method !== 'GET' ? (req.body as Record<string, unknown>) : undefined,
      responseTime,
    }).catch(console.error);
  });

  next();
};
