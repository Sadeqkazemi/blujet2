import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source.options';

/**
 * Coexists with PrismaModule for the length of the Prisma -> TypeORM
 * migration (see docs/features/typeorm-migration-phase-0.md and -phase-2.md).
 * @Global() so `DataSource`/`EntityManager` are injectable anywhere,
 * mirroring PrismaModule's shape — individual feature modules additionally
 * import `TypeOrmModule.forFeature([...])` for `@InjectRepository` as they
 * get converted, module by module, in later phases.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forRoot(dataSourceOptions)],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
