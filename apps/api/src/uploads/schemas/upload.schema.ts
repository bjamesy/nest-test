import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UploadStatus } from '../enums/upload-status.enum.js';

export type UploadDocument = HydratedDocument<Upload>;

@Schema({ _id: false })
class UploadPart {
  @Prop({ required: true })
  partNumber: number;

  @Prop({ required: true })
  etag: string;
}

const UploadPartSchema = SchemaFactory.createForClass(UploadPart);

@Schema({ timestamps: true })
export class Upload {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  size: number;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ type: String, enum: UploadStatus, default: UploadStatus.Pending })
  status: UploadStatus;

  @Prop()
  multipartUploadId?: string;

  @Prop({ type: [UploadPartSchema], default: [] })
  parts: UploadPart[];

  @Prop()
  completedAt?: Date;
}

export const UploadSchema = SchemaFactory.createForClass(Upload);
