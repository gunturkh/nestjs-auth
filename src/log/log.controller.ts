import { Controller, Get, UseGuards } from '@nestjs/common';
import { LogService } from './log.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('log')
export class LogController {
  constructor(private logService: LogService) {}
  @UseGuards(AuthGuard('jwt'))
  @Get('/statistic')
  async getStatistic() {
    try {
      const data = await this.logService.getStatistic();
      return { data };
    } catch (error) {
      return { msg: 'Get statistic failed' };
    }
  }
}
