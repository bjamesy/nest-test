import { IsInt, IsString, Min } from 'class-validator';

export class UploadPartDto {
  @IsInt()
  @Min(1)
  partNumber: number;

  @IsString()
  etag: string;
}
