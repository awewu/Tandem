import { withApiLog } from '@/lib/api-log/with-api-log';/**
 * GET /api/admin/users/bulk-invite/template
 *
 * 下载通讯录 CSV 模板, 给 IT 填写后回传到 POST /api/admin/users/bulk-invite.
 */

export const dynamic = 'force-static';

const TEMPLATE = `email,name,department,roles
zhang@example.com,张三,产品部,employee
li@example.com,李四,技术部,manager
wang@example.com,王五,财务部,employee;hr
`;

async function GETApiHandler() {
  return new Response('\ufeff' + TEMPLATE, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': 'attachment; filename="tandem-invite-template.csv"',
    },
  });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/admin/users/bulk-invite/template' });
