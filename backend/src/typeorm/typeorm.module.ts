import { Global, Module } from '@nestjs/common';
import { TypeORMService } from './typeorm.service';

@Global()
@Module({
  providers: [TypeORMService],
  exports: [TypeORMService],
})
export class TypeORMModule {}
