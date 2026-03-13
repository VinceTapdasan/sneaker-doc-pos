import { IsString, IsIn, IsNumberString, IsOptional, IsBoolean } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsString()
  @IsIn(['primary', 'add_on'])
  type: 'primary' | 'add_on';

  @IsNumberString()
  price: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
