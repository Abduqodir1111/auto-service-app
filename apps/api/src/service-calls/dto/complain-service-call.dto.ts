import { IsOptional, IsString, Length } from 'class-validator';

export class ComplainServiceCallDto {
  /**
   * Short reason code/label, e.g. "no_show" or free-form Russian text.
   * Required so the admin can triage quickly.
   */
  @IsString()
  @Length(3, 80)
  reason!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  comment?: string;
}
