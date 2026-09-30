import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

/**
 * Worker process: BullMQ consumers, cron jobs, outbox relay, PDF rendering.
 * Same image as the API (backend/md/02-architecture.md §1), started with
 * `node dist/worker.js` under its own PM2 process (`logix-worker`).
 * TODO(S0): register queue processors as modules add them.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.get(Logger).log('Worker started (no queues registered yet)');

  // `createApplicationContext` has no open handles of its own, and an
  // unresolved Promise does NOT keep Node's event loop alive on its own —
  // only a real pending handle (timer, socket, etc.) does. Without one the
  // process exits immediately after boot and PM2 restart-loops it. A ref'd
  // interval is the simplest real keep-alive; drop it once BullMQ
  // processors are registered (they hold their own handles).
  setInterval(() => {}, 1 << 30);
}

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

void bootstrap();
