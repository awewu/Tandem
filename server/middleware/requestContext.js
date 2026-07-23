const crypto = require('crypto');

const requestLogBuffer = [];
const MAX_LOGS = 1000;

function createRequestContext(options = {}) {
  const serviceName = options.serviceName || 'rhautt-nexus';
  const slowMs = options.slowMs || 1000;
  const criticalMs = options.criticalMs || 5000;

  return function requestContext(req, res, next) {
    const startedAt = Date.now();
    const incomingId = req.headers['x-request-id'];
    const incomingTraceId = req.headers['x-trace-id'];
    const requestId = incomingId || crypto.randomUUID();
    const traceId = incomingTraceId || requestId;

    req.requestId = requestId;
    req.traceId = traceId;
    req.startedAt = startedAt;
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Trace-ID', traceId);

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const entry = {
        service: serviceName,
        requestId,
        traceId,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip || req.socket?.remoteAddress,
        userId: req.user?.id,
        tenantId: req.tenantId || req.user?.tenantId
      };

      requestLogBuffer.push(entry);
      if (requestLogBuffer.length > MAX_LOGS) requestLogBuffer.shift();

      const level = res.statusCode >= 500 || durationMs >= criticalMs
        ? 'error'
        : res.statusCode >= 400 || durationMs >= slowMs
          ? 'warn'
          : 'info';

      console[level](JSON.stringify({
        event: 'http_request',
        ...entry
      }));
    });

    next();
  };
}

function getRecentRequestLogs(limit = 100) {
  return requestLogBuffer.slice(-limit);
}

function getRequestMetrics(options = {}) {
  const logs = requestLogBuffer.slice(-(options.limit || MAX_LOGS));
  const total = logs.length;
  const status2xx = logs.filter(entry => entry.statusCode >= 200 && entry.statusCode < 300).length;
  const status4xx = logs.filter(entry => entry.statusCode >= 400 && entry.statusCode < 500).length;
  const status5xx = logs.filter(entry => entry.statusCode >= 500).length;
  const durations = logs.map(entry => entry.durationMs).sort((left, right) => left - right);
  const percentile = p => {
    if (!durations.length) return 0;
    const index = Math.min(durations.length - 1, Math.max(0, Math.ceil((p / 100) * durations.length) - 1));
    return durations[index];
  };

  return {
    window: {
      sampleSize: total,
      maxStored: MAX_LOGS
    },
    requests: {
      total,
      status2xx,
      status4xx,
      status5xx,
      errorRate: total ? Number((status5xx / total).toFixed(4)) : 0
    },
    latencyMs: {
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
      max: durations.length ? durations[durations.length - 1] : 0
    },
    recent: logs.slice(-Math.min(options.recentLimit || 20, 100))
  };
}

module.exports = {
  createRequestContext,
  getRecentRequestLogs,
  getRequestMetrics
};
