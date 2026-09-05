import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job as BullJob } from 'bullmq';
import { INGESTION_QUEUE, IngestionJobPayload, JobStatus } from '@prep-proj/shared';
import { JobsRepository } from '../jobs/jobs.repository.js';

@Processor(INGESTION_QUEUE)
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(private readonly jobsRepository: JobsRepository) {
    super();
  }

  async process(job: BullJob<IngestionJobPayload>): Promise<void> {
    const { jobId } = job.data;
    this.logger.log(`Picked up queue job ${job.id} for Job ${jobId}`);

    await this.jobsRepository.updateStatus(jobId, JobStatus.Running, { stage: 'processing' });

    // Placeholder for real ingestion work (parse/transform/load) — see the
    // "Ingestion processing" open question in PIPELINE_DESIGN.md. This proves
    // the queue plumbing end to end before any real processing logic exists.
    this.logger.log(`Job ${jobId} processed (no-op placeholder)`);

    await this.jobsRepository.updateStatus(jobId, JobStatus.Completed, {
      stage: 'done',
      progress: 100,
    });
  }
}
