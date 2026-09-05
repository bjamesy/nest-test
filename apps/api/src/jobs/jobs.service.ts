import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { INGESTION_QUEUE, IngestionJobPayload } from '@prep-proj/shared';
import { UploadsService } from '../uploads/uploads.service.js';
import { UploadStatus } from '../uploads/enums/upload-status.enum.js';
import { Job, JobDocument } from './schemas/job.schema.js';
import { CreateJobDto } from './dto/create-job.dto.js';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    @InjectQueue(INGESTION_QUEUE) private readonly ingestionQueue: Queue<IngestionJobPayload>,
    private readonly uploadsService: UploadsService,
  ) {}

  async create(userId: string, dto: CreateJobDto): Promise<JobDocument> {
    const upload = await this.uploadsService.findOneForUser(userId, dto.uploadId);
    if (upload.status !== UploadStatus.Completed) {
      throw new BadRequestException('Upload must be completed before a job can be created');
    }

    const job = await this.jobModel.create({
      uploadId: upload._id,
      userId: new Types.ObjectId(userId),
    });

    await this.ingestionQueue.add('process-upload', { jobId: job._id.toString() });

    return job;
  }

  findAllForUser(userId: string): Promise<JobDocument[]> {
    return this.jobModel.find({ userId: new Types.ObjectId(userId) }).exec();
  }

  async findOneForUser(userId: string, id: string): Promise<JobDocument> {
    const job = await this.jobModel.findOne({ _id: id, userId: new Types.ObjectId(userId) }).exec();
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }
}
