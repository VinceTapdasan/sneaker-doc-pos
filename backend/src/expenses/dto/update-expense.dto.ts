import { IsString, IsNumberString, IsOptional, IsIn, ValidateIf } from 'class-validator';

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

  // null = remove photo; string = new URL; omitted = no change
  @IsOptional()
  @ValidateIf((o) => o.photoUrl != null)
  @IsString()
  photoUrl?: string | null;
}
