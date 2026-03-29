import { HttpException, HttpStatus } from '@nestjs/common';

interface AppExceptionOptions {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
}

export class AppException extends HttpException {
  public readonly code: string;
  public readonly details?: any;

  constructor(options: AppExceptionOptions) {
    super(options.message, options.statusCode);

    this.code = options.code;
    this.details = options.details;
  }
}