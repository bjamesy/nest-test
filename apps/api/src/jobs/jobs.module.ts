import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { INGESTION_QUEUE } from '@prep-proj/shared';
import { Job, JobSchema } from './schemas/job.schema.js';
import { JobsService } from './jobs.service.js';
import { JobsController } from './jobs.controller.js';
import { UploadsModule } from '../uploads/uploads.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }]),
    BullModule.registerQueue({ name: INGESTION_QUEUE }),
    UploadsModule,
    AuthModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
