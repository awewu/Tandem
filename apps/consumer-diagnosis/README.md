# consumer-diagnosis

Target app for 瑞诺瓦 AI 问诊.

- Current compatibility surface: `public/pain-diagnosis.html`
- Target runtime: Next.js / React / TypeScript
- Product boundary: C-end consultation flow; do not convert to enterprise dashboard
- Product module: `rysnova-consumer-system`
- Namespace: `rysnova`
- Data namespace: `rysnova`
- API namespace: `/api/v2/diagnosis`
- Deployment model: can be embedded from the Rhautt group portal and can also launch standalone through `/rysnova`, `/rysnova-ai`, and `/rysnova-diagnosis`
- Data boundary: `rhautt_nexus.product_modules`, `rhautt_nexus.product_module_deployments`, and `rhautt_nexus.product_module_data_partitions` keep the module namespace, deployment mode, object storage prefix, and future database extraction strategy explicit
- Future standalone requirement: external domain/deploy proof is still required before this scaffold can be claimed as final standalone launch evidence
- Support expression: `Powered by Rhautt Comfort`; Rhautt Comfort is not the primary module logo
- Status: scaffold only, not production implementation proof
