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

  // Fastify's built-in JSON parser 400s on `Content-Type: application/json`
  // + a zero-length body ("Body cannot be empty when content-type is set to
  // 'application/json'"), rejected before the request ever reaches a
  // controller — no AppError, nothing in our own logs. The app's Dio client
  // sets that content-type on every request as a default header, including
  // bodyless POSTs (logout, service-request submit, ...), so any endpoint
  // with no @Body() silently 400'd. Caught live: /service-requests/:id/submit
  // kept failing even though every field it validates was already saved —
  // logout() masked the same bug for itself by clearing the local session
  // regardless of the API result ("best-effort", session_cubit.dart).
  // Treat an empty body as `{}` instead of an error.
  app
    .getHttpAdapter()
    .getInstance()
    .addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (_req: unknown, body: string, done: (err: Error | null, result?: unknown) => void) => {
        if (!body || body.length === 0) {
          done(null, {});
          return;
        }
        try {
          done(null, JSON.parse(body));
        } catch (err) {
          done(err as Error, undefined);
        }
      },
    );

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AppErrorFilter());
  // TODO(prod): restrict to known origins once the app/dashboard domains
  // are final. Wide open for now — dev/test only, no cookies/credentials
  // are sent cross-origin by the app (Bearer tokens in headers instead).
  //
  // `methods` matters: @fastify/cors defaults to GET,HEAD,POST only, so
  // every PUT/PATCH/DELETE endpoint (business-profile, addresses, /me, ...)
  // was silently failing CORS preflight from any browser client — caught
  // live wiring the app's business-profile screen, which showed as a
  // generic "no internet" error with no server-side trace at all.
  app.enableCors({ origin: true, methods: 'GET,HEAD,POST,PUT,PATCH,DELETE' });
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
