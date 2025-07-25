import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { SignalsModule } from './signals/signals.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // ConfigService is available throughout the app
      load: [configuration], // Load the custom configuratin
      envFilePath: '../.env',
    }),
    SignalsModule,
    DatabaseModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
