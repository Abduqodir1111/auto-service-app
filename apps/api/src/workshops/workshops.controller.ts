import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@stomvp/shared';
import { Request } from 'express';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { ListWorkshopsQueryDto } from './dto/list-workshops-query.dto';
import { ModerateWorkshopDto } from './dto/moderate-workshop.dto';
import { UpdateWorkshopDto } from './dto/update-workshop.dto';
import { WorkshopsService } from './workshops.service';

@ApiTags('workshops')
@Controller('workshops')
export class WorkshopsController {
  constructor(private readonly workshopsService: WorkshopsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @Get('owner/mine')
  mine(@CurrentUser() user: JwtUser, @Req() request: Request) {
    return this.workshopsService.getMine(user.sub, request);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @Post('draft')
  createDraft(@CurrentUser() user: JwtUser, @Req() request: Request) {
    return this.workshopsService.createDraft(user.sub, request);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateWorkshopDto) {
    return this.workshopsService.create(user.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateWorkshopDto,
  ) {
    return this.workshopsService.update(id, user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.workshopsService.submitForModeration(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.workshopsService.remove(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/pending')
  pending() {
    return this.workshopsService.listPending();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/:id/moderate')
  moderate(@Param('id') id: string, @Body() dto: ModerateWorkshopDto) {
    return this.workshopsService.moderate(id, dto);
  }

  @Get()
  list(@Query() query: ListWorkshopsQueryDto, @Req() request: Request) {
    return this.workshopsService.listPublic(query, request);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  details(@Param('id') id: string, @Req() request: Request) {
    const actor = (request as Request & { user?: JwtUser }).user;
    return this.workshopsService.getDetails(id, actor, request);
  }
}
