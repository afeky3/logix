import { Global, Module } from '@nestjs/common';
import { CountriesService } from './countries.service';

@Global()
@Module({
  providers: [CountriesService],
  exports: [CountriesService],
})
export class CountriesModule {}
