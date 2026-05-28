import { IsString, Length } from 'class-validator';

export class ConfirmAccountDeleteDto {
  @IsString()
  @Length(4, 8)
  code!: string;
}
