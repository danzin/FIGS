import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common'; // Import ValidationPipe

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port');

  app.setGlobalPrefix('api/v1'); // Optional: Set a global API prefix

  // Enable global validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that are not in the DTO
      transform: true, // Transform payloads to DTO instances (e.g., string to number)
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are present
    }),
  );

  await app.listen(Number(port));
  console.log(`Signal Query API is running on: ${await app.getUrl()}`);
}
bootstrap();
