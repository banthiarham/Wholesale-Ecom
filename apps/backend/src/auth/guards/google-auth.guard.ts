import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

// GoogleStrategy is only registered when GOOGLE_CLIENT_ID is set (see
// AuthModule). Without this check, hitting the Google routes on a deployment
// that doesn't use Google sign-in surfaces as a 500 "Unknown authentication
// strategy" rather than something a caller can act on.
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (!this.configService.get<string>('GOOGLE_CLIENT_ID')) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }
    return super.canActivate(context);
  }
}
