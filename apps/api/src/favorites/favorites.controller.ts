import { Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { getRequestOrigin } from '../uploads/uploads.utils';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Req() request: Request) {
    return this.favoritesService.list(user.sub, getRequestOrigin(request));
  }

  @Post(':workshopId')
  add(@CurrentUser() user: JwtUser, @Param('workshopId') workshopId: string) {
    return this.favoritesService.add(user.sub, workshopId);
  }

  @Delete(':workshopId')
  remove(@CurrentUser() user: JwtUser, @Param('workshopId') workshopId: string) {
    return this.favoritesService.remove(user.sub, workshopId);
  }
}
