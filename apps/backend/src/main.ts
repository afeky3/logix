import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyMultipart from '@fastify/multipart';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppErrorFilter } from './common/errors/app-error.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );

  const maxSizeMb = Number(process.env.FILES_MAX_SIZE_MB ?? 20);
  // `as never`: pnpm hoists two slightly different `fastify` typings
  // (this package's peer dep vs. the one Nest resolves), so the plugin's
  // structural type doesn't quite match at compile time even though the
  // runtime versions are compatible.
  await app.register(fastifyMultipart as never, {
    limits: { fileSize: maxSizeMb * 1024 * 1024, files: 1 },
  });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AppErrorFilter());
  // TODO(prod): restrict to known origins once the app/dashboard domains
  // are final. Wide open for now — dev/test only, no cookies/credentials
  // are sent cross-origin by the app (Bearer tokens in headers instead).
  app.enableCors({ origin: true });
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health/live', method: RequestMethod.GET }, { path: 'health/ready', method: RequestMethod.GET }],
  });

  if (process.env.NODE_ENV !== 'prod') {
    const config = new DocumentBuilder()
      .setTitle('Logix API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port, '127.0.0.1');
}

void bootstrap();
