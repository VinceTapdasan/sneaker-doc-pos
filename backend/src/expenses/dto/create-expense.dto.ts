import { IsString, IsNumberString, IsOptional, IsIn, Matches } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateKey must be YYYY-MM-DD' })
  dateKey: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsString()
  @IsIn(['cash', 'gcash', 'card', 'bank_deposit'])
  method: string;

  @IsNumberString()
  amount: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
