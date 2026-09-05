import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JobStatus } from '@prep-proj/shared';
import { Job, JobDocument } from './schemas/job.schema.js';

@Injectable()
export class JobsRepository {
  constructor(@InjectModel(Job.name) private readonly jobModel: Model<JobDocument>) {}

  async updateStatus(
    jobId: string,
    status: JobStatus,
    extra: Partial<Pick<Job, 'stage' | 'progress' | 'error'>> = {},
  ): Promise<void> {
    await this.jobModel.updateOne({ _id: jobId }, { $set: { status, ...extra } }).exec();
  }
}
