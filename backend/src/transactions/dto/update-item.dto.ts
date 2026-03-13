import { IsString, IsOptional, IsNumber } from 'class-validator';

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  shoeDescription?: string;

  @IsOptional()
  @IsNumber()
  serviceId?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  beforeImageUrl?: string;

  @IsOptional()
  @IsString()
  afterImageUrl?: string;
}
