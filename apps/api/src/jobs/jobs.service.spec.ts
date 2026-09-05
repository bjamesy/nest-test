import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { INGESTION_QUEUE } from '@prep-proj/shared';
import { Types } from 'mongoose';
import { UploadsService } from '../uploads/uploads.service.js';
import { UploadStatus } from '../uploads/enums/upload-status.enum.js';
import { Job } from './schemas/job.schema.js';
import { JobsService } from './jobs.service.js';

describe('JobsService', () => {
  let jobsService: JobsService;
  let jobModel: { create: ReturnType<typeof vi.fn>; find: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> };
  let uploadsService: { findOneForUser: ReturnType<typeof vi.fn> };
  let ingestionQueue: { add: ReturnType<typeof vi.fn> };
  const userId = new Types.ObjectId().toString();
  const uploadId = new Types.ObjectId().toString();

  beforeEach(async () => {
    jobModel = {
      create: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
    };
    uploadsService = {
      findOneForUser: vi.fn(),
    };
    ingestionQueue = {
      add: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: getModelToken(Job.name), useValue: jobModel },
        { provide: getQueueToken(INGESTION_QUEUE), useValue: ingestionQueue },
        { provide: UploadsService, useValue: uploadsService },
      ],
    }).compile();

    jobsService = module.get(JobsService);
  });

  describe('create', () => {
    it('creates a job when the upload is completed', async () => {
      uploadsService.findOneForUser.mockResolvedValue({
        _id: uploadId,
        status: UploadStatus.Completed,
      });
      jobModel.create.mockResolvedValue({ _id: 'job-1' });

      const result = await jobsService.create(userId, { uploadId });

      expect(uploadsService.findOneForUser).toHaveBeenCalledWith(userId, uploadId);
      expect(jobModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ uploadId, userId: expect.any(Types.ObjectId) }),
      );
      expect(ingestionQueue.add).toHaveBeenCalledWith('process-upload', { jobId: 'job-1' });
      expect(result).toEqual({ _id: 'job-1' });
    });

    it('throws BadRequestException when the upload is not completed', async () => {
      uploadsService.findOneForUser.mockResolvedValue({
        _id: uploadId,
        status: UploadStatus.Pending,
      });

      await expect(jobsService.create(userId, { uploadId })).rejects.toThrow(
        BadRequestException,
      );
      expect(jobModel.create).not.toHaveBeenCalled();
      expect(ingestionQueue.add).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException when the upload does not belong to the user', async () => {
      uploadsService.findOneForUser.mockRejectedValue(new NotFoundException('Upload not found'));

      await expect(jobsService.create(userId, { uploadId })).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneForUser', () => {
    it('throws NotFoundException when missing or not owned', async () => {
      const exec = vi.fn().mockResolvedValue(null);
      jobModel.findOne.mockReturnValue({ exec });

      await expect(jobsService.findOneForUser(userId, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
