import {
  ArgumentsHost,
  BadRequestException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import * as Sentry from "@sentry/node";

export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly configService: ConfigService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const status = this.getStatus(exception);
    const responseBody = this.buildResponse(exception, request, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        "Unhandled exception caught by AllExceptionsFilter",
        exception instanceof Error ? exception.stack : String(exception),
      );
      if (this.configService.get<string>("SENTRY_DSN")) {
        Sentry.captureException(exception);
      }
    }

    response.status(status).json(responseBody);
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private buildResponse(exception: unknown, request: any, status: number) {
    const defaultMessage = "Unexpected error occurred";
    let error = HttpStatus[status] ?? "Error";
    let message: string | string[] = defaultMessage;

    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === "string") {
        message = response;
      } else if (typeof response === "object" && response !== null) {
        error = (response as any).error ?? error;
        const responseMessage = (response as any).message;

        if (Array.isArray(responseMessage)) {
          message = responseMessage;
        } else if (typeof responseMessage === "string") {
          message = responseMessage;
        } else if (
          typeof responseMessage === "object" &&
          responseMessage !== null
        ) {
          message = JSON.stringify(responseMessage);
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (
      status === HttpStatus.BAD_REQUEST &&
      exception instanceof BadRequestException
    ) {
      const response = exception.getResponse();
      if (
        typeof response === "object" &&
        response !== null &&
        Array.isArray((response as any).message)
      ) {
        message = (response as any).message;
      }
    }

    return {
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request?.url ?? "",
    };
  }
}
