---
name: auth-login
description: Authentication flow for 瑞诺瓦AI舒适家. Use when implementing login, token management, protected routes, or debugging 401 errors.
---

# Auth & Login — 瑞诺瓦AI舒适家

## Architecture
```
Frontend (4000) → API call /api/v2/... 
  → Next.js rewrite → Express (3001)
  → Proxy → NestJS (3300)
  → JWT verified by AuthGuard
```

## Login Endpoint
```
POST http://localhost:3001/api/v2/auth/login
Content-Type: application/json
{"phone": "13900000001", "password": "Rhautt2024!"}

Response: {"token": "eyJ...", "user": {"id":"...", "tenantId":"...", "role":"dealer_admin"}}
```

## Test Accounts (all password: Rhautt2024!)
| Phone | Name | Role |
|-------|------|------|
| 13900000001 | 王经理 | dealer_admin |
| 13800000001 | 平台管理员 | platform_admin |
| 13900000003 | 张销售 | sales |
| 13900000002 | 李设计师 | designer |

## Token Storage (frontend)
```ts
localStorage.setItem('token', token)
localStorage.getItem('token')  // read in api.ts apiFetch
```

## API Client Pattern (api.ts)
```ts
async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
```

## Login Page Implementation
```tsx
// apps/dealer-workbench/src/app/login/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const login = async () => {
    try {
      const res = await fetch('/api/v2/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || '登录失败'); return; }
      localStorage.setItem('token', data.token);
      router.push('/dashboard');
    } catch { setError('网络错误'); }
  };

  return (/* login form using DESIGN.md classes */);
}
```

## Protected Route Pattern
```tsx
// In layout or middleware: check localStorage.getItem('token')
// If null → redirect to /login
```

## Debug 401
1. Check: `localStorage.getItem('token')` in browser console
2. Token expired? Decode at jwt.io — check `exp` field
3. Re-login: `POST /api/v2/auth/login`
4. NestJS logs: `tail -f /tmp/dw.log`
