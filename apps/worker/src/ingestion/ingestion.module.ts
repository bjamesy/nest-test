import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { INGESTION_QUEUE } from '@prep-proj/shared';
import { JobsModule } from '../jobs/jobs.module.js';
import { IngestionProcessor } from './ingestion.processor.js';

@Module({
  imports: [BullModule.registerQueue({ name: INGESTION_QUEUE }), JobsModule],
  providers: [IngestionProcessor],
})
export class IngestionModule {}
