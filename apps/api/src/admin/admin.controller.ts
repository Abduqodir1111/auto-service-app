import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@stomvp/shared';
import { Request } from 'express';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateReportStatusDto } from '../reports/dto/update-report-status.dto';
import { ModerateReviewDto } from '../reviews/dto/moderate-review.dto';
import { ModeratePhotoDto } from '../uploads/dto/moderate-photo.dto';
import { getRequestOrigin } from '../uploads/uploads.utils';
import { ModerateWorkshopDto } from '../workshops/dto/moderate-workshop.dto';
import { AdminService } from './admin.service';
import { BlockUserDto } from './dto/block-user.dto';
import { VerifyMasterDto } from './dto/verify-master.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('analytics')
  analytics() {
    return this.adminService.analytics();
  }

  @Get('analytics/events')
  eventsAnalytics() {
    return this.adminService.getEventsAnalytics();
  }

  @Get('analytics/testers')
  testersActivity() {
    return this.adminService.getTestersActivity();
  }

  @Get('users')
  users() {
    return this.adminService.listUsers();
  }

  @Patch('users/:id/block')
  blockUser(
    @Param('id') id: string,
    @Body() dto: BlockUserDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.adminService.blockUser(id, dto.isBlocked, user.sub);
  }

  @Patch('users/:id/verify-master')
  verifyMaster(
    @Param('id') id: string,
    @Body() dto: VerifyMasterDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.adminService.verifyMaster(id, dto.isVerifiedMaster, user.sub);
  }

  /**
   * Mark / unmark a user as a Closed-Testing tester. The daily Telegram
   * report (and the /testers page) covers exactly this set.
   */
  @Patch('users/:id/tester')
  markTester(
    @Param('id') id: string,
    @Body() dto: { isTester: boolean },
  ) {
    return this.adminService.markTester(id, dto.isTester);
  }

  /** Bulk mark via list of phones. Convenient for one-shot setup. */
  @Patch('testers/bulk-mark')
  bulkMarkTesters(@Body() dto: { phones: string[]; isTester?: boolean }) {
    return this.adminService.bulkMarkTesters(dto.phones, dto.isTester ?? true);
  }

  /** Run the daily report on demand (skips the cron wait). */
  @Get('testers/run-report')
  runTesterReport() {
    return this.adminService.runTesterReport();
  }

  @Get('workshops')
  workshops() {
    return this.adminService.listWorkshops();
  }

  @Patch('workshops/:id/moderate')
  moderateWorkshop(
    @Param('id') id: string,
    @Body() dto: ModerateWorkshopDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.adminService.moderateWorkshop(id, dto, user.sub);
  }

  @Get('reviews')
  reviews() {
    return this.adminService.listReviewsPending();
  }

  @Patch('reviews/:id/moderate')
  moderateReview(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.adminService.moderateReview(id, dto, user.sub);
  }

  @Get('photos')
  photos(@Req() request: Request) {
    return this.adminService.listPhotosPending(getRequestOrigin(request));
  }

  @Patch('photos/:id/moderate')
  moderatePhoto(
    @Param('id') id: string,
    @Body() dto: ModeratePhotoDto,
    @Req() request: Request,
    @CurrentUser() user: JwtUser,
  ) {
    return this.adminService.moderatePhoto(id, dto.status, getRequestOrigin(request), user.sub);
  }

  @Get('reports')
  reports() {
    return this.adminService.listReports();
  }

  @Patch('reports/:id/status')
  updateReportStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.adminService.updateReportStatus(id, dto, user.sub);
  }

  @Get('moderation-history')
  moderationHistory() {
    return this.adminService.listModerationHistory();
  }

  @Get('applications')
  applications() {
    return this.adminService.listApplications();
  }
}
