import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MULTIPART_CHUNK_SIZE } from '@prep-proj/shared';
import { Types } from 'mongoose';
import { StorageService } from '../storage/storage.service.js';
import { UploadStatus } from './enums/upload-status.enum.js';
import { Upload } from './schemas/upload.schema.js';
import { UploadsService } from './uploads.service.js';

describe('UploadsService', () => {
  let uploadsService: UploadsService;
  let uploadModel: { create: ReturnType<typeof vi.fn>; find: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> };
  let storageService: {
    getPresignedPutUrl: ReturnType<typeof vi.fn>;
    headObject: ReturnType<typeof vi.fn>;
    createMultipartUpload: ReturnType<typeof vi.fn>;
    getPresignedUploadPartUrls: ReturnType<typeof vi.fn>;
    completeMultipartUpload: ReturnType<typeof vi.fn>;
  };
  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    uploadModel = {
      create: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
    };
    storageService = {
      getPresignedPutUrl: vi.fn(),
      headObject: vi.fn(),
      createMultipartUpload: vi.fn(),
      getPresignedUploadPartUrls: vi.fn(),
      completeMultipartUpload: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: getModelToken(Upload.name), useValue: uploadModel },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    uploadsService = module.get(UploadsService);
  });

  describe('initiate', () => {
    it('generates a storage key, persists the upload, and returns a single-PUT plan for small files', async () => {
      uploadModel.create.mockResolvedValue({ _id: 'upload-1' });
      storageService.getPresignedPutUrl.mockResolvedValue({
        url: 'https://r2.example/signed',
        expiresIn: 900,
      });

      const result = await uploadsService.initiate(userId, {
        filename: 'data.csv',
        size: 1024,
        mimeType: 'text/csv',
      });

      expect(uploadModel.create).toHaveBeenCalledTimes(1);
      const payload = uploadModel.create.mock.calls[0][0];
      expect(payload.filename).toBe('data.csv');
      expect(payload.size).toBe(1024);
      expect(payload.mimeType).toBe('text/csv');
      expect(payload.key.startsWith(`${userId}/`)).toBe(true);
      expect(payload.key.endsWith('-data.csv')).toBe(true);
      expect(payload.userId.toString()).toBe(userId);

      expect(storageService.getPresignedPutUrl).toHaveBeenCalledWith(payload.key, 'text/csv');
      expect(storageService.createMultipartUpload).not.toHaveBeenCalled();
      expect(result).toEqual({
        upload: { _id: 'upload-1' },
        strategy: 'single',
        signedUrl: 'https://r2.example/signed',
        expiresIn: 900,
      });
    });

    it('returns a multipart plan for files larger than the chunk size', async () => {
      const size = MULTIPART_CHUNK_SIZE * 2 + 1; // requires 3 parts
      storageService.createMultipartUpload.mockResolvedValue('upload-id-abc');
      uploadModel.create.mockResolvedValue({ _id: 'upload-1' });
      storageService.getPresignedUploadPartUrls.mockResolvedValue([
        { partNumber: 1, signedUrl: 'https://r2.example/part1' },
        { partNumber: 2, signedUrl: 'https://r2.example/part2' },
        { partNumber: 3, signedUrl: 'https://r2.example/part3' },
      ]);

      const result = await uploadsService.initiate(userId, {
        filename: 'big.csv',
        size,
        mimeType: 'text/csv',
      });

      const payload = uploadModel.create.mock.calls[0][0];
      expect(payload.multipartUploadId).toBe('upload-id-abc');
      expect(storageService.getPresignedUploadPartUrls).toHaveBeenCalledWith(
        payload.key,
        'upload-id-abc',
        3,
      );
      expect(storageService.getPresignedPutUrl).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          upload: { _id: 'upload-1' },
          strategy: 'multipart',
          multipartUploadId: 'upload-id-abc',
          chunkSize: MULTIPART_CHUNK_SIZE,
          parts: [
            { partNumber: 1, signedUrl: 'https://r2.example/part1' },
            { partNumber: 2, signedUrl: 'https://r2.example/part2' },
            { partNumber: 3, signedUrl: 'https://r2.example/part3' },
          ],
        }),
      );
    });
  });

  describe('findAllForUser', () => {
    it('scopes the query to the given user', async () => {
      const exec = vi.fn().mockResolvedValue([{ _id: 'upload-1' }]);
      uploadModel.find.mockReturnValue({ exec });

      const result = await uploadsService.findAllForUser(userId);

      expect(uploadModel.find).toHaveBeenCalledWith({ userId: expect.any(Types.ObjectId) });
      expect(result).toEqual([{ _id: 'upload-1' }]);
    });
  });

  describe('findOneForUser', () => {
    it('returns the upload when found and owned by the user', async () => {
      const exec = vi.fn().mockResolvedValue({ _id: 'upload-1' });
      uploadModel.findOne.mockReturnValue({ exec });

      const result = await uploadsService.findOneForUser(userId, 'upload-1');

      expect(result).toEqual({ _id: 'upload-1' });
    });

    it('throws NotFoundException when missing or not owned', async () => {
      const exec = vi.fn().mockResolvedValue(null);
      uploadModel.findOne.mockReturnValue({ exec });

      await expect(uploadsService.findOneForUser(userId, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('complete', () => {
    it('marks a single-PUT upload completed when the object exists in storage', async () => {
      const upload = {
        status: UploadStatus.Pending,
        key: 'some/key.csv',
        save: vi.fn().mockResolvedValue(undefined),
      };
      const exec = vi.fn().mockResolvedValue(upload);
      uploadModel.findOne.mockReturnValue({ exec });
      storageService.headObject.mockResolvedValue({ size: 2048 });

      await uploadsService.complete(userId, 'upload-1');

      expect(storageService.headObject).toHaveBeenCalledWith('some/key.csv');
      expect(storageService.completeMultipartUpload).not.toHaveBeenCalled();
      expect(upload.status).toBe(UploadStatus.Completed);
      expect(upload.completedAt).toBeInstanceOf(Date);
      expect(upload.save).toHaveBeenCalledTimes(1);
    });

    it('is idempotent when already completed', async () => {
      const upload = {
        status: UploadStatus.Completed,
        key: 'some/key.csv',
        save: vi.fn(),
      };
      const exec = vi.fn().mockResolvedValue(upload);
      uploadModel.findOne.mockReturnValue({ exec });

      const result = await uploadsService.complete(userId, 'upload-1');

      expect(result).toBe(upload);
      expect(storageService.headObject).not.toHaveBeenCalled();
      expect(upload.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the object is not in storage yet', async () => {
      const upload = {
        status: UploadStatus.Pending,
        key: 'some/key.csv',
        save: vi.fn(),
      };
      const exec = vi.fn().mockResolvedValue(upload);
      uploadModel.findOne.mockReturnValue({ exec });
      storageService.headObject.mockResolvedValue(null);

      await expect(uploadsService.complete(userId, 'upload-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(upload.save).not.toHaveBeenCalled();
    });

    it('completes a multipart upload via CompleteMultipartUpload when parts are given', async () => {
      const upload = {
        status: UploadStatus.Pending,
        key: 'some/key.csv',
        multipartUploadId: 'upload-id-abc',
        save: vi.fn().mockResolvedValue(undefined),
      };
      const exec = vi.fn().mockResolvedValue(upload);
      uploadModel.findOne.mockReturnValue({ exec });
      const parts = [
        { partNumber: 1, etag: 'etag-1' },
        { partNumber: 2, etag: 'etag-2' },
      ];

      await uploadsService.complete(userId, 'upload-1', parts);

      expect(storageService.completeMultipartUpload).toHaveBeenCalledWith(
        'some/key.csv',
        'upload-id-abc',
        parts,
      );
      expect(storageService.headObject).not.toHaveBeenCalled();
      expect(upload.parts).toEqual(parts);
      expect(upload.status).toBe(UploadStatus.Completed);
      expect(upload.save).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when completing a multipart upload without parts', async () => {
      const upload = {
        status: UploadStatus.Pending,
        key: 'some/key.csv',
        multipartUploadId: 'upload-id-abc',
        save: vi.fn(),
      };
      const exec = vi.fn().mockResolvedValue(upload);
      uploadModel.findOne.mockReturnValue({ exec });

      await expect(uploadsService.complete(userId, 'upload-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(storageService.completeMultipartUpload).not.toHaveBeenCalled();
      expect(upload.save).not.toHaveBeenCalled();
    });
  });
});
