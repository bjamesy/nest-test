import { IsInt, IsPositive, IsString, MinLength } from 'class-validator';

export class CreateUploadDto {
  @IsString()
  @MinLength(1)
  filename: string;

  @IsInt()
  @IsPositive()
  size: number;

  @IsString()
  @MinLength(1)
  mimeType: string;
}
