import { ValidationError } from 'class-validator';

export function formatValidationErrors(errors: ValidationError[]) {
  return errors.map((err) => ({
    field: err.property,
    message: Object.values(err.constraints || {}).join(', '),
  }));
}