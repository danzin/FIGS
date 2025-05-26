import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { SignalsModule } from './signals/signals.module';
import { SignalsModule } from './signals/signals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // ConfigService is available throughout the app
      load: [configuration], // Load the custom configuratin
      envFilePath: '../.env',
    }),
    SignalsModule, // Import the feature module for signals
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
