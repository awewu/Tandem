# Production Gate

Before claiming production readiness:

```bash
npm run harness:all
npm run test:production-readiness
npm run perf:baseline
```

Do not claim full production readiness if:

- MongoDB readiness is not proven
- OpenTelemetry/SLO alerts are absent
- target-scale scenario load tests are absent
- duplicate route groups remain unresolved
- active page contracts fail
