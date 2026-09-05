import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { JobStatus } from '@prep-proj/shared';

export type JobDocument = HydratedDocument<Job>;

// collection pinned explicitly since apps/worker also defines its own
// (narrower) Job schema pointed at the same collection — see
// apps/worker/src/jobs/schemas/job.schema.ts.
@Schema({ timestamps: true, collection: 'jobs' })
export class Job {
  @Prop({ type: Types.ObjectId, ref: 'Upload', required: true, index: true })
  uploadId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: JobStatus, default: JobStatus.Queued })
  status: JobStatus;

  @Prop()
  stage?: string;

  @Prop({ default: 0 })
  progress: number;

  @Prop()
  error?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  result?: unknown;
}

export const JobSchema = SchemaFactory.createForClass(Job);
