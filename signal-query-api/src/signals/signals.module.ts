import { Module } from '@nestjs/common';
import { SignalsController } from '../controllers/signals.controller';
import { SignalsService } from '../services/signals.service';
import { SignalsRepository } from '../repositories/signals.repository';

@Module({
  controllers: [SignalsController],
  providers: [SignalsService, SignalsRepository],
})
export class SignalsModule {}
