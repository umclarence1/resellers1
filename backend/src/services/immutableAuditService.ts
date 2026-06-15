import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog';

export type AuditAction =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'wallet_adjustment'
  | 'purchase'
  | 'withdrawal'
  | 'role_change'
  | 'commission_change'
  | 'agent_create'
  | 'webhook_rejected'
  | 'admin_reauth_failed'
  | string;

/** Append-only security and compliance audit log. */
export async function appendAuditLog(input: {
  userId?: mongoose.Types.ObjectId | string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}) {
  return AuditLog.create({
    userId: input.userId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    details: input.details,
    ip: input.ip,
  });
}

/** @deprecated Use appendAuditLog — kept for securityAuditService compatibility */
export async function logSecurityEvent(input: {
  userId?: mongoose.Types.ObjectId | string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  success: boolean;
}) {
  return appendAuditLog({
    userId: input.userId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    details: { ...input.details, success: input.success },
    ip: input.ip,
  });
}
