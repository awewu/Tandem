import { Global, Module } from '@nestjs/common';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';

export const TARGET_API_BOOT_SMOKE = process.env.TARGET_API_BOOT_SMOKE === 'true';

function createQueryBuilderMock() {
  const qb: Record<string, unknown> = {};
  const chain = () => qb;

  Object.assign(qb, {
    where: chain,
    andWhere: chain,
    orderBy: chain,
    limit: chain,
    offset: chain,
    take: chain,
    leftJoinAndSelect: chain,
    select: chain,
    getMany: async () => [],
    getManyAndCount: async () => [[], 0],
    getOne: async () => null,
    getOneOrFail: async () => {
      throw new Error('boot-smoke repository has no rows');
    },
  });

  return qb;
}

export function createBootSmokeRepository(entityName: string) {
  return {
    target: entityName,
    find: async () => [],
    findOne: async () => null,
    findOneBy: async () => null,
    findOneByOrFail: async () => {
      throw new Error(`boot-smoke repository has no ${entityName} row`);
    },
    save: async (value: unknown) => value,
    create: (value: unknown) => value,
    update: async () => ({ affected: 0 }),
    createQueryBuilder: createQueryBuilderMock,
  };
}

export function bootSmokeRepositoryProvider(entity: new (...args: any[]) => any) {
  return {
    provide: getRepositoryToken(entity),
    useValue: createBootSmokeRepository(entity.name),
  };
}

// Stub DataSource so services that inject @InjectDataSource() can instantiate
// during boot-smoke (no real TypeOrmModule.forRoot). transaction() runs the
// callback against a mock EntityManager; queries return empty.
function createBootSmokeManager() {
  return {
    getRepository: (entity: any) =>
      createBootSmokeRepository(typeof entity === 'function' ? entity.name : String(entity)),
    query: async () => [],
    save: async (_e: unknown, value: unknown) => value,
    update: async () => ({ affected: 0 }),
  };
}

export function createBootSmokeDataSource() {
  const manager = createBootSmokeManager();
  return {
    isInitialized: true,
    manager,
    getRepository: (entity: any) =>
      createBootSmokeRepository(typeof entity === 'function' ? entity.name : String(entity)),
    query: async () => [],
    transaction: async (arg1: any, arg2?: any) => {
      const work = typeof arg1 === 'function' ? arg1 : arg2;
      return work(manager);
    },
  };
}

// @Global so the stub DataSource is injectable in every feature module during
// boot-smoke. Imported by AppModule only when TARGET_API_BOOT_SMOKE is set.
@Global()
@Module({
  providers: [{ provide: getDataSourceToken(), useValue: createBootSmokeDataSource() }],
  exports: [getDataSourceToken()],
})
export class BootSmokeInfraModule {}
