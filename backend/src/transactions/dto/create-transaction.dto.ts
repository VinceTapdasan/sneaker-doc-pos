import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumberString,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransactionItemDto {
  @IsString()
  shoeDescription: string;

  @IsOptional()
  @IsNumber()
  serviceId?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  addonServiceIds?: number[];

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  beforeImageUrl?: string;

  @IsOptional()
  @IsString()
  afterImageUrl?: string;

  @IsOptional()
  @IsNumberString()
  price?: string;
}

export class CreateTransactionDto {
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
  customerStreetName?: string;

  @IsOptional()
  @IsString()
  customerCity?: string;

  @IsOptional()
  @IsString()
  customerCountry?: string;

  @IsOptional()
  @IsBoolean()
  isExistingCustomer?: boolean;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'pickupDate must be YYYY-MM-DD' })
  pickupDate?: string;

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
  staffId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionItemDto)
  items?: CreateTransactionItemDto[];
}
