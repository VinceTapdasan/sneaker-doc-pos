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
}
