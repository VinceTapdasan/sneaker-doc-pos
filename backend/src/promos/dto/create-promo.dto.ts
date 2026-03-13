import { IsString, IsNumberString, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreatePromoDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsNumberString()
  percent: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateFrom must be YYYY-MM-DD' })
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateTo must be YYYY-MM-DD' })
  dateTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
