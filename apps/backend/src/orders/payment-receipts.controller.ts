import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaymentReceiptsService } from './payment-receipts.service';

const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const PROOF_DIR = 'payment-proofs';

const actorOf = (user: any) => ({ id: user.id, isAdmin: user.role === UserRole.ADMIN });

@ApiTags('Payment receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders/:orderId/receipts')
export class PaymentReceiptsController {
  constructor(private receipts: PaymentReceiptsService) {}

  @Get()
  @ApiOperation({ summary: 'Part payments for an order with paid / pending / balance (owner or admin)' })
  @ApiParam({ name: 'orderId' })
  list(@Param('orderId') orderId: string, @CurrentUser() user: any) {
    return this.receipts.list(orderId, actorOf(user));
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Record a part payment with optional proof (admin: counts at once; customer: waits for verification)' })
  @UseInterceptors(
    FileInterceptor('proof', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) =>
        PROOF_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new BadRequestException('Proof must be an image (JPG, PNG, WEBP) or a PDF'), false),
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', PROOF_DIR);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        // Unguessable name: proofs can show bank details.
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase().slice(0, 8)}`),
      }),
    }),
  )
  create(
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
    @Body() body: Record<string, string>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.receipts.create(orderId, actorOf(user), {
      amount: Number(body.amount),
      method: body.method,
      reference: body.reference,
      receivedAt: body.receivedAt,
      note: body.note,
      proofUrl: file ? `/uploads/${PROOF_DIR}/${file.filename}` : undefined,
      proofName: file ? file.originalname.slice(0, 200) : undefined,
    });
  }

  @Patch(':receiptId/verify')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Verify a payment a customer submitted (Admin)' })
  verify(@Param('orderId') orderId: string, @Param('receiptId') receiptId: string, @CurrentUser() user: any) {
    return this.receipts.verify(orderId, receiptId, actorOf(user));
  }

  @Patch(':receiptId/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject a submitted payment with a reason (Admin)' })
  reject(@Param('orderId') orderId: string, @Param('receiptId') receiptId: string, @Body('reason') reason: string, @CurrentUser() user: any) {
    return this.receipts.reject(orderId, receiptId, actorOf(user), reason);
  }

  @Delete(':receiptId')
  @ApiOperation({ summary: 'Delete a receipt (admin), or withdraw your own payment still awaiting verification' })
  remove(@Param('orderId') orderId: string, @Param('receiptId') receiptId: string, @CurrentUser() user: any) {
    return this.receipts.remove(orderId, receiptId, actorOf(user));
  }
}
