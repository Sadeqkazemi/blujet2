import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TypeORMClient } from '../../generated/typeorm/client';

@Injectable()
export class TypeORMService
  extends TypeORMClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
