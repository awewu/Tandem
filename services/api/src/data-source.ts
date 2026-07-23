import 'reflect-metadata';
import { DataSource } from 'typeorm';

/**
 * Standalone TypeORM DataSource for tooling and inspection (CLI, entity
 * introspection, tests). Runtime schema management is handled by the curated
 * SQL migrations in database/postgres/migrations via scripts/db/apply-migrations.js
 * — NOT by TypeORM synchronize. Hence synchronize:false and migrationsRun:false.
 *
 * Entities are loaded by glob so this stays in sync with the modules without a
 * hand-maintained list.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || process.env.POSTGRES_URI,
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  username: process.env.POSTGRES_USER || 'rhautt',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'rhautt_nexus',
  schema: 'rhautt_nexus',
  entities: [__dirname + '/modules/**/*.entity.{ts,js}'],
  synchronize: false,
  migrationsRun: false,
  logging: process.env.NODE_ENV === 'development',
});
