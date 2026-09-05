import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { JobStatus } from '@prep-proj/shared';

export type JobDocument = HydratedDocument<Job>;

/**
 * Minimal mirror of apps/api's Job schema. The worker only ever updates
 * status/progress fields, so it defines its own narrow schema rather than
 * importing apps/api's runtime Mongoose class — per PIPELINE_DESIGN.md,
 * only types (JobStatus, IngestionJobPayload) cross the api/worker boundary,
 * not runtime code. `collection: 'jobs'` pins both services to the same
 * MongoDB collection regardless of each schema's own shape.
 */
@Schema({ timestamps: true, collection: 'jobs' })
export class Job {
  @Prop({ type: String, enum: JobStatus, default: JobStatus.Queued })
  status: JobStatus;

  @Prop()
  stage?: string;

  @Prop({ default: 0 })
  progress: number;

  @Prop()
  error?: string;
}

export const JobSchema = SchemaFactory.createForClass(Job);
