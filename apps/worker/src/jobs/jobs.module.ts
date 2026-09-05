import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Job, JobSchema } from './schemas/job.schema.js';
import { JobsRepository } from './jobs.repository.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }])],
  providers: [JobsRepository],
  exports: [JobsRepository],
})
export class JobsModule {}
