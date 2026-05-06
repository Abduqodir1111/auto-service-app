import { IsLatitude, IsLongitude } from 'class-validator';

export class MasterLocationDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}
