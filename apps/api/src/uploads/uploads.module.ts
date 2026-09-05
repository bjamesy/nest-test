import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { Upload, UploadSchema } from './schemas/upload.schema.js';
import { UploadsService } from './uploads.service.js';
import { UploadsController } from './uploads.controller.js';
import { UploadInitiateRateLimitGuard } from './guards/upload-initiate-rate-limit.guard.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Upload.name, schema: UploadSchema }]),
    AuthModule,
    StorageModule,
  ],
  controllers: [UploadsController],
  providers: [UploadsService, UploadInitiateRateLimitGuard],
  exports: [UploadsService],
})
export class UploadsModule {}
