import { IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateServiceCallDto {
  @IsUUID()
  categoryId!: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsString()
  @Length(5, 32)
  clientPhone!: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  address?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}
