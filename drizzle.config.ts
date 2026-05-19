import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/infra/drizzle-schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://tandem:tandem@localhost:5440/tandem',
  },
  strict: true,
  verbose: true,
} satisfies Config;
