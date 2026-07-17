import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TypeORMPg } from '@typeorm/adapter-pg';
import { TypeORMClient } from '../../generated/typeorm/client';

@Injectable()
export class TypeORMService
  extends TypeORMClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new TypeORMPg({ connectionString: process.env.DATABASE_URL }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
