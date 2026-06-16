'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DelegationPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/persona/evolution?tab=delegation');
  }, [router]);
  return null;
}
