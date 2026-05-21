import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { SensorReadingsService } from './sensor-readings.service';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';

@Controller('sensor-readings')
export class SensorReadingsController {
  constructor(private readonly service: SensorReadingsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get('trash-bin/:trashBinId')
  listByBin(@Param('trashBinId', new ParseUUIDPipe()) trashBinId: string) {
    return this.service.listByBin(trashBinId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateSensorReadingDto) {
    return this.service.create(body);
  }
}
