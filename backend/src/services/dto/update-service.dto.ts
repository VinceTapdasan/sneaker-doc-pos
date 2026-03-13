import { IsString, IsIn, IsNumberString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['primary', 'add_on'])
  type?: 'primary' | 'add_on';

  @IsOptional()
  @IsNumberString()
  price?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
