import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // Strip unknown properties
      forbidNonWhitelisted: false, // Don't reject — just strip (safer rollout)
      transform: true,       // Auto-transform payloads to DTO instances
    }),
  );
  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map(o => o.trim());
  app.enableCors({
    origin: origins,
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
