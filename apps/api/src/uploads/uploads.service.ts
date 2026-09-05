import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InitiateUploadPlan, MULTIPART_CHUNK_SIZE, UploadPartInput } from '@prep-proj/shared';
import { StorageService } from '../storage/storage.service.js';
import { Upload, UploadDocument } from './schemas/upload.schema.js';
import { UploadStatus } from './enums/upload-status.enum.js';
import { CreateUploadDto } from './dto/create-upload.dto.js';

@Injectable()
export class UploadsService {
  constructor(
    @InjectModel(Upload.name) private readonly uploadModel: Model<UploadDocument>,
    private readonly storageService: StorageService,
  ) {}

  async initiate(userId: string, dto: CreateUploadDto): Promise<InitiateUploadPlan<UploadDocument>> {
    const key = `${userId}/${randomUUID()}-${dto.filename}`;
    const partCount = Math.ceil(dto.size / MULTIPART_CHUNK_SIZE);

    if (partCount <= 1) {
      const upload = await this.uploadModel.create({
        userId: new Types.ObjectId(userId),
        key,
        filename: dto.filename,
        size: dto.size,
        mimeType: dto.mimeType,
      });

      const { url, expiresIn } = await this.storageService.getPresignedPutUrl(key, dto.mimeType);

      return { upload, strategy: 'single', signedUrl: url, expiresIn };
    }

    const multipartUploadId = await this.storageService.createMultipartUpload(key, dto.mimeType);
    const upload = await this.uploadModel.create({
      userId: new Types.ObjectId(userId),
      key,
      filename: dto.filename,
      size: dto.size,
      mimeType: dto.mimeType,
      multipartUploadId,
    });

    const parts = await this.storageService.getPresignedUploadPartUrls(
      key,
      multipartUploadId,
      partCount,
    );

    return {
      upload,
      strategy: 'multipart',
      multipartUploadId,
      chunkSize: MULTIPART_CHUNK_SIZE,
      parts,
      expiresIn: 15 * 60,
    };
  }

  findAllForUser(userId: string): Promise<UploadDocument[]> {
    return this.uploadModel.find({ userId: new Types.ObjectId(userId) }).exec();
  }

  async findOneForUser(userId: string, id: string): Promise<UploadDocument> {
    const upload = await this.uploadModel
      .findOne({ _id: id, userId: new Types.ObjectId(userId) })
      .exec();
    if (!upload) {
      throw new NotFoundException('Upload not found');
    }
    return upload;
  }

  async complete(userId: string, id: string, parts?: UploadPartInput[]): Promise<UploadDocument> {
    const upload = await this.findOneForUser(userId, id);

    if (upload.status === UploadStatus.Completed) {
      return upload;
    }

    if (upload.multipartUploadId) {
      if (!parts || parts.length === 0) {
        throw new BadRequestException('parts are required to complete a multipart upload');
      }
      await this.storageService.completeMultipartUpload(upload.key, upload.multipartUploadId, parts);
      upload.parts = parts.map((part) => ({ partNumber: part.partNumber, etag: part.etag }));
    } else {
      const metadata = await this.storageService.headObject(upload.key);
      if (!metadata) {
        throw new BadRequestException(
          'Object not found in storage — the upload may not have finished yet',
        );
      }
    }

    upload.status = UploadStatus.Completed;
    upload.completedAt = new Date();
    return upload.save();
  }
}
