import { IsMongoId } from 'class-validator';

export class CreateJobDto {
  @IsMongoId()
  uploadId: string;
}
