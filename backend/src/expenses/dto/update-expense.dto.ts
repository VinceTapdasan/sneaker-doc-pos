import { IsString, IsNumberString, IsOptional, IsIn } from 'class-validator';

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  @IsIn(['cash', 'gcash', 'card', 'bank_deposit'])
  method?: string;

  @IsOptional()
  @IsNumberString()
  amount?: string;
}
