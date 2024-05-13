import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor() {
    super({
      //   accessType: 'offline',
      prompt: 'select_account', //"consent"
    });
  }
  async canActivate(context: ExecutionContext) {
    try {
      const request = context.switchToHttp().getRequest() as Request;
      const from = (request.query.state as string)?.replace(/\@/g, '/');
      // response.setHeader('X-Frame-Options', 'SAMEORIGIN');
      // await super.logIn(request) //to enabling session / we dont need it

      const activate = (await super.canActivate(context)) as boolean;
      request.params.from = from;
      return activate;
    } catch (ex) {
      throw ex;
    }
  }
}
