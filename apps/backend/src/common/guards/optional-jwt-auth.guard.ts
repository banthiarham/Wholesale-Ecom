import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT auth guard — populates req.user when a valid JWT is present,
 * but does NOT block unauthenticated requests (guests).
 *
 * When no JWT is provided, Passport returns user=false and info with an error.
 * This guard swallows that info and allows the request through with req.user = null.
 * When a valid JWT is provided, the user is attached to req.user normally.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, _info: any) {
    // Return the user if authenticated, or null if not.
    // Swallow any errors/info — we intentionally allow unauthenticated requests.
    return user || null;
  }
}