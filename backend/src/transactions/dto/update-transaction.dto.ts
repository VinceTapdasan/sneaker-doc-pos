import { IsString, IsOptional, IsNumber, IsNumberString, Matches } from 'class-validator';

export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'pickupDate must be YYYY-MM-DD' })
  pickupDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'newPickupDate must be YYYY-MM-DD' })
  newPickupDate?: string | null;

  @IsOptional()
  @IsNumberString()
  total?: string;

  @IsOptional()
  @IsNumberString()
  paid?: string;

  @IsOptional()
  @IsNumber()
  promoId?: number;

  @IsOptional()
  @IsString()
  staffId?: string | null;
}
