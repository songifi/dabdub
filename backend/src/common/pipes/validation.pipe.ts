import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ValidationException } from '../errors/exceptions/http-exceptions';
import { ValidationError as CustomValidationError } from '../errors/error-response.dto';

/**
 * Custom Validation Pipe with detailed error messages
 * Extends NestJS validation to provide comprehensive error details
 */
@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  constructor(
    private readonly options?: {
      whitelist?: boolean;
      forbidNonWhitelisted?: boolean;
      transform?: boolean;
      transformOptions?: {
        enableImplicitConversion?: boolean;
      };
    },
  ) {}

  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const opts = {
      whitelist: this.options?.whitelist ?? true,
      forbidNonWhitelisted: this.options?.forbidNonWhitelisted ?? true,
      transform: this.options?.transform ?? true,
      transformOptions: {
        enableImplicitConversion:
          this.options?.transformOptions?.enableImplicitConversion ?? true,
      },
    };

    const object = plainToInstance(metatype, value);
    const errors = await validate(object, opts);

    if (errors.length > 0) {
      const validationErrors = this.formatValidationErrors(errors);
      throw new ValidationException(validationErrors, 'Validation failed', {
        value,
      });
    }

    return object;
  }

  /**
   * Check if the type should be validated
   */
  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  /**
   * Format validation errors into a structured format
   */
  private formatValidationErrors(
    errors: ValidationError[],
  ): CustomValidationError[] {
    const formattedErrors: CustomValidationError[] = [];

    for (const error of errors) {
      if (error.constraints) {
        // Handle direct field errors
        formattedErrors.push(
          new CustomValidationError({
            field: error.property,
            message: Object.values(error.constraints)[0],
            rejectedValue: error.value,
            constraints: error.constraints,
          }),
        );
      }

      // Handle nested object errors
      if (error.children && error.children.length > 0) {
        const nestedErrors = this.formatValidationErrors(error.children);
        for (const nestedError of nestedErrors) {
          formattedErrors.push(
            new CustomValidationError({
              field: `${error.property}.${nestedError.field}`,
              message: nestedError.message,
              rejectedValue: nestedError.rejectedValue,
              constraints: nestedError.constraints,
            }),
          );
        }
      }
    }

    return formattedErrors;
  }
}
