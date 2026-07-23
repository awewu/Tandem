import { getSession, ssoEnabled, canWrite, listProducts, fetchTaxonomy } from '../lib/brand';
import Login from '../components/Login';
import Console from '../components/Console';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) return <Login sso={ssoEnabled()} />;
  const [products, taxonomy] = await Promise.all([
    listProducts({ page: 1, pageSize: 20 }),
    fetchTaxonomy(),
  ]);
  return (
    <Console
      userName={session.name}
      role={session.role}
      canWrite={canWrite(session.role)}
      initialRows={products.items}
      initialTotal={products.total}
      initialPages={products.pages}
      initialTaxonomy={taxonomy}
    />
  );
}
