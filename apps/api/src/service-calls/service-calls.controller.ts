import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateServiceCallDto } from './dto/create-service-call.dto';
import { ComplainServiceCallDto } from './dto/complain-service-call.dto';
import { MasterLocationDto } from './dto/master-location.dto';
import { ServiceCallsService } from './service-calls.service';

@ApiTags('service-calls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('service-calls')
export class ServiceCallsController {
  constructor(private readonly service: ServiceCallsService) {}

  /** Client kicks off an on-demand call. */
  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateServiceCallDto) {
    return this.service.create(user.sub, user.role, dto);
  }

  /** Client polls this every ~2s while the waiting screen is visible. */
  @Get(':id')
  getById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getById(id, user.sub, user.role);
  }

  /**
   * Master polls this when the app is in foreground to discover an
   * incoming call (in case the push got lost or app was backgrounded).
   * Returns null when nothing is ringing them.
   */
  @Get('master/active')
  getActiveForMaster(@CurrentUser() user: JwtUser) {
    return this.service.getActiveForMaster(user.sub);
  }

  /**
   * Client polls this from the home screen so the "Срочный вызов" card
   * can morph into a live status card (SEARCHING progress / ASSIGNED with
   * master info). Returns null when no live call.
   */
  @Get('client/active')
  getActiveForClient(@CurrentUser() user: JwtUser) {
    return this.service.getActiveForClient(user.sub);
  }

  /**
   * Master pushes their current GPS while heading to the client. Allowed
   * only for the assigned master and only while the call is ASSIGNED.
   */
  @Post(':id/master-location')
  reportMasterLocation(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: MasterLocationDto,
  ) {
    return this.service.reportMasterLocation(id, user.sub, dto);
  }

  /** Master swipe-accepts. */
  @Post(':id/accept')
  accept(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.accept(id, user.sub);
  }

  /** Master rejects (button) or the dispatcher rotates them off. */
  @Post(':id/reject')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.reject(id, user.sub);
  }

  /** Client cancels (search or even after assignment). */
  @Post(':id/cancel')
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.cancel(id, user.sub);
  }

  /** Either party marks the job done. */
  @Post(':id/complete')
  complete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.complete(id, user.sub);
  }

  /**
   * Client files a complaint about no-show / cancellation. Surfaces in
   * the admin Reports moderation queue (targetType=SERVICE_CALL).
   */
  @Post(':id/complain')
  complain(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ComplainServiceCallDto,
  ) {
    return this.service.complain(id, user.sub, dto);
  }

  /** History of own calls (client = sent, master = received & accepted). */
  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.service.listMine(user.sub, user.role);
  }
}
