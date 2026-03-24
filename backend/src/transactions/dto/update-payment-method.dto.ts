import { IsString, IsIn, IsOptional } from 'class-validator';

export class UpdatePaymentMethodDto {
  @IsString()
  @IsIn(['cash', 'gcash', 'card', 'bank_deposit'])
  method: 'cash' | 'gcash' | 'card' | 'bank_deposit';

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  // Required when method='card' and a specific bank applies. null/undefined = default (3%)
  @IsOptional()
  @IsString()
  cardBank?: string;
}
