import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './app-error';

/**
 * Global filter → the response envelope from backend/md/05-api-conventions.md §5:
 * { error: { code, message, details[], requestId, retryable } }
 */
@Catch()
export class AppErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<FastifyRequest>();
    const requestId = (req.headers['x-request-id'] as string) ?? req.id;

    if (exception instanceof AppError) {
      res.status(exception.httpStatus).send({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
          requestId,
          retryable: exception.retryable,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      res.status(status).send({
        error: {
          code: status === HttpStatus.NOT_FOUND ? 'NOT_FOUND' : 'VALIDATION_FAILED',
          message: exception.message,
          requestId,
          retryable: false,
        },
      });
      return;
    }

    this.logger.error(exception);
    res.status(500).send({
      error: { code: 'UNKNOWN', message: 'Internal error', requestId, retryable: false },
    });
  }
}
