import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PresignedPart, UploadPartInput } from '@prep-proj/shared';

export interface ObjectMetadata {
  size: number;
  contentType?: string;
}

const PRESIGNED_URL_EXPIRY_SECONDS = 15 * 60;

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.getOrThrow<string>('R2_ACCOUNT_ID');
    this.bucket = this.configService.getOrThrow<string>('R2_BUCKET');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  async getPresignedPutUrl(key: string, contentType: string): Promise<{ url: string; expiresIn: number }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    });

    return { url, expiresIn: PRESIGNED_URL_EXPIRY_SECONDS };
  }

  async createMultipartUpload(key: string, contentType: string): Promise<string> {
    const result = await this.client.send(
      new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
    );
    if (!result.UploadId) {
      throw new Error('R2 did not return an UploadId for CreateMultipartUpload');
    }
    return result.UploadId;
  }

  async getPresignedUploadPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return getSignedUrl(this.client, command, { expiresIn: PRESIGNED_URL_EXPIRY_SECONDS });
  }

  async getPresignedUploadPartUrls(
    key: string,
    uploadId: string,
    partCount: number,
  ): Promise<PresignedPart[]> {
    const parts: PresignedPart[] = [];
    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const signedUrl = await this.getPresignedUploadPartUrl(key, uploadId, partNumber);
      parts.push({ partNumber, signedUrl });
    }
    return parts;
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: UploadPartInput[],
  ): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
            .slice()
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
        },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }),
    );
  }

  async headObject(key: string): Promise<ObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: result.ContentLength ?? 0,
        contentType: result.ContentType,
      };
    } catch (error) {
      if (error instanceof NotFound) {
        return null;
      }
      throw error;
    }
  }
}
