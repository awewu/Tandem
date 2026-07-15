import { beforeEach, describe, expect, it } from 'vitest';
import { createHmac } from 'crypto';
import { queryBusinessLogs, resetBusinessLogsForTests } from '@/lib/business-log/service';
import { queryApiLogs, resetApiLogsForTests } from '@/lib/api-log/service';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function flushDeferredWrites(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('api log', () => {
  beforeEach(() => {
    resetApiLogsForTests();
    resetBusinessLogsForTests();
  });

  it('records HTTP details without creating a business operation', async () => {
    const handler = withApiLog(
      async (req: Request) => {
        await req.json();
        return Response.json({ ok: true }, { status: 201 });
      },
      { route: '/api/widgets/[id]' },
    );
    const response = await handler(new Request('http://localhost/api/widgets/w_1?source=test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'req_api_1',
        'x-tandem-user-id': 'user_1',
        'x-tandem-tenant-id': 'tenant_api_1',
      },
      body: JSON.stringify({ name: 'Widget', password: 'do-not-store', content: 'private text' }),
    }));
    expect(response.status).toBe(201);
    await flushDeferredWrites();

    const apiResult = await queryApiLogs({ tenantId: 'tenant_api_1' });
    expect(apiResult.entries).toHaveLength(1);
    expect(apiResult.entries[0]).toMatchObject({
      requestId: 'req_api_1', actorId: 'user_1', method: 'POST', route: '/api/widgets/[id]', statusCode: 201,
    });
    expect(JSON.stringify(apiResult.entries[0].requestData)).not.toContain('do-not-store');
    expect(JSON.stringify(apiResult.entries[0].requestData)).not.toContain('private text');

    const businessResult = await queryBusinessLogs({ tenantId: 'tenant_api_1' });
    expect(businessResult.entries).toHaveLength(0);
  });

  it('accepts only signed middleware and Edge ingestion', async () => {
    process.env.API_LOG_INGEST_SECRET = 'unit-test-api-log-secret';
    const { POST } = await import('@/app/api/internal/api-log-ingest/route');
    const body = JSON.stringify({
      tenantId: 'tenant_edge_1', actorId: 'edge_user', actorType: 'user', source: 'edge', category: 'realtime',
      operation: 'GET /api/realtime/[channel]', action: 'read', method: 'GET', path: '/api/realtime/test',
      route: '/api/realtime/[channel]', outcome: 'success', summary: 'GET realtime success (200)', statusCode: 200,
    });
    const timestamp = String(Date.now());
    const signature = createHmac('sha256', process.env.API_LOG_INGEST_SECRET).update(`${timestamp}.${body}`).digest('hex');
    const response = await POST(new Request('http://localhost/api/internal/api-log-ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-log-timestamp': timestamp, 'x-api-log-signature': signature },
      body,
    }));
    expect(response.status).toBe(204);
    const result = await queryApiLogs({ tenantId: 'tenant_edge_1' });
    expect(result.entries[0]).toMatchObject({ source: 'edge', actorId: 'edge_user', outcome: 'success' });

    const rejected = await POST(new Request('http://localhost/api/internal/api-log-ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-log-timestamp': timestamp, 'x-api-log-signature': 'invalid' },
      body,
    }));
    expect(rejected.status).toBe(401);
    delete process.env.API_LOG_INGEST_SECRET;
  });
});
