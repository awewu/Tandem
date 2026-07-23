const DESIGNER_VIEWER_PORT = process.env.DESIGNER_WORKBENCH_PORT || '4003';
const DESIGNER_VIEWER_PATH = '/viewer';
const LEGACY_DESIGNER_QUERY_KEYS = Object.freeze([
  'projectId',
  'project_id',
  'project',
  'contractId',
  'contract_id',
  'contract',
  'opportunityId',
  'opportunity_id',
  'opportunity',
  'artifactId',
  'artifact_id',
  'artifact',
  'id'
]);

function requestProtocol(req) {
  return req.get?.('x-forwarded-proto') || req.protocol || 'http';
}

function requestHost(req) {
  return req.get?.('host') || req.headers?.host || `localhost:${DESIGNER_VIEWER_PORT}`;
}

function queryFromRequest(req) {
  const rawUrl = req.originalUrl || req.url || '';
  const queryIndex = rawUrl.indexOf('?');
  if (queryIndex >= 0) return rawUrl.slice(queryIndex + 1);
  return req.query || '';
}

function preservedDesignerQuery(sourceQuery) {
  const source = new URLSearchParams(sourceQuery || '');
  const target = new URLSearchParams();

  for (const key of LEGACY_DESIGNER_QUERY_KEYS) {
    for (const value of source.getAll(key)) {
      if (value) target.append(key, value);
    }
  }

  return target.toString();
}

function buildLegacyDesignerRedirectTarget(req) {
  const target = new URL(DESIGNER_VIEWER_PATH, `${requestProtocol(req)}://${requestHost(req)}`);
  target.port = DESIGNER_VIEWER_PORT;
  target.search = preservedDesignerQuery(queryFromRequest(req));
  return target.toString();
}

function redirectLegacyDesignerToViewer(req, res) {
  return res.redirect(302, buildLegacyDesignerRedirectTarget(req));
}

module.exports = {
  DESIGNER_VIEWER_PATH,
  DESIGNER_VIEWER_PORT,
  LEGACY_DESIGNER_QUERY_KEYS,
  buildLegacyDesignerRedirectTarget,
  preservedDesignerQuery,
  redirectLegacyDesignerToViewer
};
