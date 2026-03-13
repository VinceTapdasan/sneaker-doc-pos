import { IsString, IsIn } from 'class-validator';

export class AddPhotoDto {
  @IsString()
  @IsIn(['before', 'after'])
  type: 'before' | 'after';

  @IsString()
  url: string;
}
