import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Logger } from 'nestjs-pino';
import { ErrorCode } from '../errors';

const FALLBACK_MESSAGE = 'خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.';

/** Central error handler — never leaks stack traces; always returns the API envelope. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const { code, message } = this.resolveBody(exception, isHttp, status);

    const trace = exception instanceof Error ? exception.stack : undefined;
    if (status >= 500) {
      this.logger.error(
        `Unhandled exception: ${code}`,
        trace,
        AllExceptionsFilter.name,
      );
    } else {
      this.logger.warn(`Handled exception: ${code}`, AllExceptionsFilter.name);
    }

    response.status(status).json({
      success: false,
      error: { code, message },
    });
  }

  private resolveBody(exception: unknown, isHttp: boolean, status: number) {
    if (!isHttp) {
      return { code: ErrorCode.INTERNAL_ERROR, message: FALLBACK_MESSAGE };
    }

    const body = (exception as HttpException).getResponse();
    if (
      typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      'message' in body
    ) {
      return body as { code: string; message: string };
    }

    const fallbackByStatus: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
      [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
    };

    const message =
      typeof body === 'string'
        ? body
        : ((body as { message?: string })?.message ?? FALLBACK_MESSAGE);

    return {
      code: fallbackByStatus[status] ?? ErrorCode.INTERNAL_ERROR,
      message,
    };
  }
}
