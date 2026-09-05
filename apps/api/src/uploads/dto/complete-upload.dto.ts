import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { UploadPartDto } from './upload-part.dto.js';

export class CompleteUploadDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UploadPartDto)
  parts?: UploadPartDto[];
}
