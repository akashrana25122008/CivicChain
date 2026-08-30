import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Uniform API error type. Thrown in route handlers / server logic and
 * converted to a sanitised JSON response by handleApiError. Never leaks
 * database internals or secrets to the browser.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const unauthorized = () =>
  new ApiError(401, 'UNAUTHENTICATED', 'You must be signed in to access this resource.');
export const forbidden = () =>
  new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
export const notFound = (what = 'Resource') =>
  new ApiError(404, 'NOT_FOUND', `${what} was not found.`);
export const badRequest = (message: string) =>
  new ApiError(400, 'INVALID_INPUT', message);

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    const message = first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input.';
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message } },
      { status: 400 },
    );
  }
  // User input validation uses TypeError with user-safe messages (e.g. magic
  // byte / MIME / extension checks). Treat as 400, never 500.
  if (error instanceof TypeError) {
    console.error('[api] validation error:', error.message);
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: error.message } },
      { status: 400 },
    );
  }
  console.error('[api] unexpected error:', error);
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: 'Something went wrong on the server.' } },
    { status: 500 },
  );
}