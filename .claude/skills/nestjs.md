---
name: nestjs
description: NestJS + TypeORM + PostgreSQL patterns for the 瑞诺瓦AI舒适家 project. Use when creating/modifying modules, entities, services, controllers.
---

# NestJS Expert — 瑞诺瓦AI舒适家

## Project Stack
- NestJS 11 + Fastify, TypeScript strict
- TypeORM + PostgreSQL (rhautt_nexus DB)
- `synchronize: true` in dev (auto-creates tables from entities)
- All modules in `services/api/src/modules/`
- JWT auth via `AuthGuard` from `../auth/auth.guard`
- Tenant scope from `req.user.tenantId` (NEVER from headers)

## Entity Pattern
```ts
@Entity('table_name')
@Index(['tenantId', 'customerId'])
export class MyEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'varchar', nullable: true }) fieldName: string | null;
  @Column({ type: 'jsonb', default: {} }) data: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

## Service Pattern
```ts
@Injectable()
export class MyService {
  constructor(@InjectRepository(MyEntity) private readonly repo: Repository<MyEntity>) {}

  async list(user: JwtPayload) {
    return this.repo.find({ where: { tenantId: user.tenantId }, order: { createdAt: 'DESC' } });
  }
}
```

## Module Pattern
```ts
@Module({
  imports: [TypeOrmModule.forFeature([MyEntity]), AuthModule],
  controllers: [MyController],
  providers: [MyService],
  exports: [MyService],
})
export class MyModule {}
```

## Controller Pattern
```ts
@UseGuards(AuthGuard)
@Controller('my-resource')
export class MyController {
  @Get()    list(@Req() req: any) { return this.svc.list(req.user); }
  @Post()   create(@Req() req: any, @Body() b: any) { return this.svc.create(req.user, b); }
  @Get(':id') get(@Req() req: any, @Param('id') id: string) { return this.svc.get(req.user, id); }
}
```

## Rules
- ALWAYS wrap responses: `{ success: true, data: result }`
- ALWAYS scope queries by `tenantId`
- NEVER hardcode tenantId — read from `user.tenantId`
- DB password: `rhautt_dev`, user: `rhautt`, db: `rhautt_nexus`
