import { NextResponse, NextRequest } from 'next/server';
import { DomainError } from '@/lib/domain/errors';

export function withErrorHandler(handler: (req: NextRequest, ...args: any[]) => Promise<Response>) {
  return async (req: NextRequest, ...args: any[]): Promise<Response> => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      if (err instanceof DomainError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status: err.statusCode }
        );
      }
      console.error('[API] Unhandled error:', err);
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: 'Internal server error' } },
        { status: 500 }
      );
    }
  };
}
