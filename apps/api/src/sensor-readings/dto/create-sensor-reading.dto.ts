import {
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSensorReadingDto {
  @IsUUID()
  trashBinId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  fillLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  distanceCm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryLevel?: number;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sensorError?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  mqttTopic?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deviceMillis?: number;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;
}
