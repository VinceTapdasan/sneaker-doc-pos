import { IsString, IsIn, IsNumberString, IsOptional } from 'class-validator';

export class AddPaymentDto {
  @IsString()
  @IsIn(['cash', 'gcash', 'card', 'bank_deposit'])
  method: 'cash' | 'gcash' | 'card' | 'bank_deposit';

  @IsNumberString()
  amount: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  // Only relevant when method='card'. null/undefined = default rate (3%).
  // Server uses this to look up the fee rate from CARD_BANK_FEES config.
  @IsOptional()
  @IsString()
  cardBank?: string;
}
