import { Controller, Get, Param, Post, UseGuards, Body } from '@nestjs/common';
import { InitiateUploadPlan } from '@prep-proj/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { UploadsService } from './uploads.service.js';
import { CreateUploadDto } from './dto/create-upload.dto.js';
import { CompleteUploadDto } from './dto/complete-upload.dto.js';
import { UploadDocument } from './schemas/upload.schema.js';
import { UploadInitiateRateLimitGuard } from './guards/upload-initiate-rate-limit.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @UseGuards(UploadInitiateRateLimitGuard)
  @Post('initiate')
  initiate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUploadDto,
  ): Promise<InitiateUploadPlan<UploadDocument>> {
    return this.uploadsService.initiate(user.id, dto);
  }

  @Post(':id/complete')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CompleteUploadDto,
  ): Promise<UploadDocument> {
    return this.uploadsService.complete(user.id, id, dto.parts);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<UploadDocument[]> {
    return this.uploadsService.findAllForUser(user.id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<UploadDocument> {
    return this.uploadsService.findOneForUser(user.id, id);
  }
}
