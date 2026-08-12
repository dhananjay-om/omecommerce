/** Base domain error hierarchy. Interface layer maps these to RFC 9457 responses. */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly type: string = 'about:blank',
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id?: string | number | bigint) {
    super(`${entity}${id !== undefined ? ` ${id}` : ''} not found`, 'https://errors.ome/not-found', 404);
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly errors?: Array<{ path: string; message: string }>,
  ) {
    super(message, 'https://errors.ome/validation', 422);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'https://errors.ome/conflict', 409);
  }
}
