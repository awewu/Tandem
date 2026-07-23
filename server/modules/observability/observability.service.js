const { getRequestMetrics } = require('../../middleware/requestContext');

const DEFAULT_SLOS = {
  availabilityTarget: 0.995,
  p95LatencyMsTarget: 1000,
  p99LatencyMsTarget: 3000,
  sampleWindowRequests: 1000
};

function evaluateSlo(metrics, slo = DEFAULT_SLOS) {
  const total = metrics.requests.total;
  const availability = total
    ? Number(((total - metrics.requests.status5xx) / total).toFixed(4))
    : 1;
  const latencyP95Ok = metrics.latencyMs.p95 <= slo.p95LatencyMsTarget;
  const latencyP99Ok = metrics.latencyMs.p99 <= slo.p99LatencyMsTarget;
  const availabilityOk = availability >= slo.availabilityTarget;

  return {
    status: availabilityOk && latencyP95Ok && latencyP99Ok ? 'within_slo' : 'slo_risk',
    availability,
    targets: slo,
    checks: {
      availabilityOk,
      latencyP95Ok,
      latencyP99Ok
    },
    errorBudget: {
      targetAvailability: slo.availabilityTarget,
      consumedBy5xxRate: metrics.requests.errorRate,
      remaining: Number(Math.max(0, (1 - slo.availabilityTarget) - metrics.requests.errorRate).toFixed(4))
    }
  };
}

class ObservabilityService {
  constructor(options = {}) {
    this.service = options.service || 'rhautt-nexus';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.version = options.version || process.env.npm_package_version || '1.0.0';
    this.slo = { ...DEFAULT_SLOS, ...(options.slo || {}) };
    this.metricsProvider = options.metricsProvider || getRequestMetrics;
  }

  getSnapshot() {
    const metrics = this.metricsProvider({
      limit: this.slo.sampleWindowRequests,
      recentLimit: 20
    });
    const slo = evaluateSlo(metrics, this.slo);

    return {
      success: true,
      data: {
        service: this.service,
        boundary: 'observability-baseline',
        environment: this.environment,
        version: this.version,
        signals: {
          logs: 'structured-http-events',
          traces: 'request-id-and-trace-id',
          metrics: 'in-process-http-window',
          exporter: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? 'otel-otlp-configured' : 'local-baseline'
        },
        slo,
        metrics,
        timestamp: new Date().toISOString()
      }
    };
  }
}

module.exports = ObservabilityService;
module.exports.DEFAULT_SLOS = DEFAULT_SLOS;
module.exports.evaluateSlo = evaluateSlo;
