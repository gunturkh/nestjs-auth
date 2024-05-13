import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(AuthGuard('jwt'))
  @Put('/name')
  async editUserName(@Body() userData: { id: number; name: string }) {
    console.log('userData change name', userData);
    try {
      const user = await this.usersService.findById(userData.id);
      user.name = userData.name;
      await this.usersService.update(user);
      return { msg: 'Update name success' };
    } catch (error) {
      return { msg: 'Update name failed' };
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('/statistic')
  async getStatistic() {
    try {
      const data = await this.usersService.getStatistic();
      return { data };
    } catch (error) {
      return { msg: 'Get statistic failed' };
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('/all')
  async getUsers() {
    try {
      const data = await this.usersService.getUsers();
      return { data };
    } catch (error) {
      return { msg: 'Get users failed' };
    }
  }
}
