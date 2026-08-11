import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole, UserStatus, AccountType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../notifications/email.service';

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  roleId?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: Omit<User, 'password'>;
}

@Injectable()
export class AuthService {
  private static readonly RESEND_OTP_COOLDOWN_SECONDS = 60;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Determine role: roleId takes precedence, fall back to enum role → BUYER default
    let roleEnum: UserRole = registerDto.role || UserRole.BUYER;
    let roleId: string | null = registerDto.roleId || null;
    let resolvedRoleName: string = roleEnum;

    // If roleId provided, look up the enum value; otherwise resolve from enum role.
    // Dynamic roles beyond the legacy UserRole enum (e.g. Dealer, Wholesaler) can't be
    // written to the `role` column — keep the BUYER default for those and rely on
    // roleId/roleRel as the authoritative source, as done everywhere else.
    if (roleId) {
      try {
        const roleRecord = await this.prisma.role.findUnique({ where: { id: roleId } });
        if (roleRecord) {
          resolvedRoleName = roleRecord.name;
          if ((Object.values(UserRole) as string[]).includes(roleRecord.name)) {
            roleEnum = roleRecord.name as UserRole;
          }
        } else {
          roleId = null;
        }
      } catch {
        roleId = null;
      }
    } else {
      // Backfill roleId from enum role
      try {
        const roleRecord = await this.prisma.role.findUnique({ where: { name: roleEnum } });
        if (roleRecord) {
          roleId = roleRecord.id;
        }
      } catch {
        // Role table may not be seeded yet; skip
      }
    }

    // Generate referral code
    const referralCode = `${registerDto.firstName?.substring(0, 3).toUpperCase() || 'USR'}${Date.now().toString(36).toUpperCase()}`;

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        phone: registerDto.phone,
        role: roleEnum,
        roleId: roleId,
        status: UserStatus.PENDING_VERIFICATION,
        accountType: AccountType.LOCAL,
        referralCode,
        referredBy: registerDto.referralCode || null,
      },
      include: { roleRel: true },
    });

    // If user selected a non-BUYER role, create a role change request for admin approval
    if (resolvedRoleName !== UserRole.BUYER && roleId) {
      try {
        await this.prisma.roleChangeRequest.create({
          data: {
            userId: user.id,
            roleId: roleId,
            status: 'PENDING',
            reason: 'Requested during registration',
          },
        });
      } catch {
        // RoleChangeRequest table may not exist yet; skip
      }
    }

    await this.generateAndSaveOtp(user.id, 'EMAIL_VERIFICATION');

    const accessToken = this.generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    return { accessToken, user: userWithoutPassword };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Your account has been suspended. Please contact support.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    return { accessToken, user: userWithoutPassword };
  }

  async googleAuth(profile: any): Promise<AuthResponse> {
    const { id: googleId, emails, name, photos } = profile;
    const email = emails?.[0]?.value;

    if (!email) {
      throw new BadRequestException('Google account does not have an email');
    }

    let user = await this.prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email } });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            accountType: AccountType.GOOGLE,
            emailVerified: true,
          },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email,
            firstName: name?.givenName || 'Google',
            lastName: name?.familyName || 'User',
            googleId,
            accountType: AccountType.GOOGLE,
            emailVerified: true,
            status: UserStatus.ACTIVE,
            avatar: photos?.[0]?.value || null,
          },
        });
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    return { accessToken, user: userWithoutPassword };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: verifyOtpDto.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const otp = await this.prisma.oTP.findFirst({
      where: {
        userId: user.id,
        code: verifyOtpDto.code,
        purpose: 'EMAIL_VERIFICATION',
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.prisma.$transaction([
      this.prisma.oTP.update({
        where: { id: otp.id },
        data: { used: true },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          status: UserStatus.ACTIVE,
        },
      }),
    ]);

    return { message: 'Email verified successfully' };
  }

  async resendOtp(resendOtpDto: ResendOtpDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: resendOtpDto.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Rate-limit resends so a user can't spam themselves (or someone else's inbox)
    // with requests — only the most recent OTP for this purpose matters here.
    const lastOtp = await this.prisma.oTP.findFirst({
      where: { userId: user.id, purpose: 'EMAIL_VERIFICATION' },
      orderBy: { createdAt: 'desc' },
    });
    if (lastOtp) {
      const secondsSinceLast = (Date.now() - lastOtp.createdAt.getTime()) / 1000;
      if (secondsSinceLast < AuthService.RESEND_OTP_COOLDOWN_SECONDS) {
        const waitSeconds = Math.ceil(AuthService.RESEND_OTP_COOLDOWN_SECONDS - secondsSinceLast);
        throw new BadRequestException(`Please wait ${waitSeconds}s before requesting another OTP`);
      }
    }

    await this.generateAndSaveOtp(user.id, 'EMAIL_VERIFICATION');

    return { message: 'A new OTP has been sent to your email' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: forgotPasswordDto.email },
    });

    if (user) {
      const token = this.generateRandomToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      await this.prisma.passwordReset.create({
        data: {
          token,
          userId: user.id,
          expiresAt,
        },
      });
    }

    return { message: 'If your email is registered, you will receive a reset link' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const passwordReset = await this.prisma.passwordReset.findUnique({
      where: { token: resetPasswordDto.token },
    });

    if (!passwordReset || passwordReset.used || passwordReset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: passwordReset.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordReset.update({
        where: { id: passwordReset.id },
        data: { used: true },
      }),
    ]);

    return { message: 'Password reset successfully' };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    // Block suspended users from logging in
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Your account has been suspended. Please contact support.');
    }

    return user;
  }

  async validateToken(payload: TokenPayload): Promise<any> {
    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { roleRel: true },
      });
    } catch {
      user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
    }

    if (!user) return null;

    // Add effective role name for guard checks (dynamic role takes precedence, then enum role)
    (user as any).effectiveRole = user.roleRel?.name || user.role;
    return user;
  }

  buildAuthResponse(user: User): AuthResponse {
    const accessToken = this.generateToken(user);
    const { password: _, ...userWithoutPassword } = user;
    return { accessToken, user: userWithoutPassword };
  }

  async buildAuthResponseWithRole(userId: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roleRel: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const { password: _, ...userWithoutPassword } = user as any;
    // Attach effectiveRole so frontend can use it immediately
    (userWithoutPassword as any).effectiveRole = user.roleRel?.name || user.role;
    const accessToken = this.generateToken(user);
    return { accessToken, user: userWithoutPassword };
  }

  private generateToken(user: any): string {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      roleId: user.roleId || undefined,
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRATION', '7d'),
    });
  }

  private async generateAndSaveOtp(userId: string, purpose: string): Promise<any> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const otp = await this.prisma.oTP.create({
      data: {
        code,
        purpose,
        userId,
        expiresAt,
      },
    });

    // Send OTP via email if configured
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      if (this.emailService.isConfigured()) {
        try {
          await this.emailService.sendOtpEmail(user.email, code);
        } catch (err) {
          console.error('Failed to send OTP email:', err.message);
        }
      } else {
        console.warn(`SMTP not configured — OTP for ${user.email} was not emailed.`);
      }
    }

    return otp;
  }

  private generateRandomToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}