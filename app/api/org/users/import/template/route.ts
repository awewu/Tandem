import { withApiLog } from '@/lib/api-log/with-api-log';/**
 * GET /api/org/users/import/template
 *
 * Download a contact import CSV template.
 */
export const dynamic = 'force-dynamic';

const TEMPLATE = `email,name,department,jobTitle,manager,employeeId,hireDate,workLocation,phone,roles
zhang@example.com,张三,销售部,销售经理,manager@example.com,E001,2024-01-15,上海,13800000000,manager
li@example.com,李四,销售部/华东区,客户经理,张三,E002,2024-03-01,杭州,13900000000,employee
`;

async function GETApiHandler() {
  return new Response('\ufeff' + TEMPLATE, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': 'attachment; filename="contact-import-template.csv"',
    },
  });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/org/users/import/template' });
