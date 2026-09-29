import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter.
 * - NestJS HttpExceptions → pass through as-is
 * - Portal "not found" errors (isNotFound flag) → 404
 * - Everything else → 503 (portal is the backend; any unhandled error
 *   is an upstream problem from our API consumer's perspective)
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message ?? exception.message;
    } else if (exception instanceof Error && (exception as any).isNotFound) {
      status = HttpStatus.NOT_FOUND;
      message = exception.message;
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'The upstream portal is unavailable or returned an unexpected response.';
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred.';
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
