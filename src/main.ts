import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as session from 'express-session';
import * as passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    session({
      secret: 'thesecret',
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 360000 },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
  app.enableCors({
    origin: ['http://localhost:3000', 'https://incite-fe.netlify.app/'],
  });
  await app.listen(process.env.PORT || 3001);
}
bootstrap();
