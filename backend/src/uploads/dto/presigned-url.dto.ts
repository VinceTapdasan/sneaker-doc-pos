import { IsNumber, IsOptional, IsString, IsIn, Matches } from 'class-validator';

export class PresignedUrlDto {
  @IsNumber()
  txnId: number;

  @IsOptional()
  @IsNumber()
  itemId?: number;

  @IsString()
  @IsIn(['before', 'after'])
  type: 'before' | 'after';

  @IsString()
  @Matches(/^\.?(jpg|jpeg|png|webp|heic)$/i, { message: 'Only image files allowed (jpg, jpeg, png, webp, heic)' })
  extension: string;
}
