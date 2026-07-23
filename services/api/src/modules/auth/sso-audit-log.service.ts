import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';

export const SSO_AUDIT_SINK = Symbol('SSO_AUDIT_SINK');

export type SsoFailureReason =
  | 'missing_code'
  | 'missing_state'
  | 'state_mismatch'
  | 'client_secret_missing'
  | 'oidc_discovery_failed'
  | 'token_endpoint_missing'
  | 'token_endpoint_error'
  | 'jwks_endpoint_missing'
  | 'jwks_fetch_failed'
  | 'signing_key_not_found'
  | 'invalid_id_token_alg'
  | 'invalid_issuer'
  | 'invalid_audience'
  | 'expired_token'
  | 'bad_signature'
  | 'id_token_validation_failed'
  | 'invalid_iat'
  | 'userinfo_failed'
  | 'userinfo_subject_mismatch'
  | 'missing_subject'
  | 'binding_inactive'
  | 'binding_incomplete'
  | 'local_user_inactive'
  | 'tenant_mismatch'
  | 'pending_authorization'
  | 'unexpected';

export type SsoAuditEventType =
  | 'sso.login.started'
  | 'sso.login.failed'
  | 'sso.callback.succeeded'
  | 'sso.callback.failed';

export interface SsoAuditEvent {
  eventType: SsoAuditEventType;
  outcome: 'success' | 'failure';
  provider: string;
  issuer: string;
  subjectHash?: string;
  localUserId?: string;
  failureReason?: SsoFailureReason;
  requestId?: string;
  traceId?: string;
  timestamp: string;
}

export interface SsoAuditSink {
  write(event: SsoAuditEvent): void;
}

export interface SsoAuditInput {
  eventType: SsoAuditEventType;
  outcome: 'success' | 'failure';
  provider: string;
  issuer: string;
  subject?: string;
  localUserId?: string | null;
  failureReason?: SsoFailureReason;
  requestId?: string;
  traceId?: string;
}

@Injectable()
export class SsoAuditLogService {
  private readonly logger = new Logger('SsoAudit');

  constructor(@Optional() @Inject(SSO_AUDIT_SINK) private readonly sink?: SsoAuditSink) {}

  record(input: SsoAuditInput): SsoAuditEvent {
    const event: SsoAuditEvent = {
      eventType: input.eventType,
      outcome: input.outcome,
      provider: input.provider,
      issuer: input.issuer,
      timestamp: new Date().toISOString(),
    };
    if (input.subject) event.subjectHash = this.hashSubject(input.subject);
    if (input.localUserId) event.localUserId = input.localUserId;
    if (input.failureReason) event.failureReason = input.failureReason;
    if (input.requestId) event.requestId = input.requestId;
    if (input.traceId) event.traceId = input.traceId;

    this.sink?.write(event);
    this.logger.log(JSON.stringify(event));
    return event;
  }

  private hashSubject(subject: string): string {
    return `sha256:${createHash('sha256').update(subject).digest('hex').slice(0, 24)}`;
  }
}
