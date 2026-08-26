import { redactSecrets } from "@agentforge/security";

export type ServerLogLevel = "info" | "warn" | "error";

export type ServerLogEvent = {
  level: ServerLogLevel;
  message: string;
  correlationId?: string;
  action?: string;
  organizationId?: string;
  projectId?: string;
};

function newCorrelationId(): string {
  return crypto.randomUUID();
}

/** Structured control-plane log. Never include secrets or tokens. */
export function logServerEvent(event: ServerLogEvent): string {
  const correlationId = event.correlationId ?? newCorrelationId();
  const payload = {
    ts: new Date().toISOString(),
    level: event.level,
    message: redactSecrets(event.message),
    correlationId,
    action: event.action,
    organizationId: event.organizationId,
    projectId: event.projectId,
  };

  const line = JSON.stringify(payload);
  if (event.level === "error") {
    console.error(line);
  } else if (event.level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
  return correlationId;
}
