import { IsString, IsOptional } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  streetName?: string | null;

  @IsOptional()
  @IsString()
  barangay?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  province?: string | null;

  @IsOptional()
  @IsString()
  country?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;
}
