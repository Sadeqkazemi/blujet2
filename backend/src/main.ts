import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger)));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('blujet API')
    .setDescription('blujet airline platform — internal API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
  // Raw spec exported after every boot — single source of truth for docs/API.md.
  fs.writeFileSync(
    path.join(__dirname, '..', '..', '..', 'docs', 'openapi.json'),
    JSON.stringify(document, null, 2),
  );
  // (__dirname resolves to backend/dist/src at runtime — three levels up reaches the repo root.)

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`blujet backend listening on :${process.env.PORT ?? 3000}`);
}
void bootstrap();
