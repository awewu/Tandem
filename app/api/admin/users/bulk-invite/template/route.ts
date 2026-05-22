/**
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

export async function GET() {
  return new Response('\ufeff' + TEMPLATE, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': 'attachment; filename="tandem-invite-template.csv"',
    },
  });
}
