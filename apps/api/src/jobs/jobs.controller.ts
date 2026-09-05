import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { JobsService } from './jobs.service.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { JobDocument } from './schemas/job.schema.js';

@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateJobDto): Promise<JobDocument> {
    return this.jobsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<JobDocument[]> {
    return this.jobsService.findAllForUser(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<JobDocument> {
    return this.jobsService.findOneForUser(user.id, id);
  }
}
