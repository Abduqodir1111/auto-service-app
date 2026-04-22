import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@stomvp/shared';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ModerateReviewDto } from '../reviews/dto/moderate-review.dto';
import { ModeratePhotoDto } from '../uploads/dto/moderate-photo.dto';
import { getRequestOrigin } from '../uploads/uploads.utils';
import { ModerateWorkshopDto } from '../workshops/dto/moderate-workshop.dto';
import { AdminService } from './admin.service';
import { BlockUserDto } from './dto/block-user.dto';

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

  @Get('users')
  users() {
    return this.adminService.listUsers();
  }

  @Patch('users/:id/block')
  blockUser(@Param('id') id: string, @Body() dto: BlockUserDto) {
    return this.adminService.blockUser(id, dto.isBlocked);
  }

  @Get('workshops')
  workshops() {
    return this.adminService.listWorkshops();
  }

  @Patch('workshops/:id/moderate')
  moderateWorkshop(@Param('id') id: string, @Body() dto: ModerateWorkshopDto) {
    return this.adminService.moderateWorkshop(id, dto);
  }

  @Get('reviews')
  reviews() {
    return this.adminService.listReviewsPending();
  }

  @Patch('reviews/:id/moderate')
  moderateReview(@Param('id') id: string, @Body() dto: ModerateReviewDto) {
    return this.adminService.moderateReview(id, dto);
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
  ) {
    return this.adminService.moderatePhoto(id, dto.status, getRequestOrigin(request));
  }

  @Get('applications')
  applications() {
    return this.adminService.listApplications();
  }
}
