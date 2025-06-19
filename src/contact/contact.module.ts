import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './contact.entity';

@Module({
  controllers: [ContactController],
  providers: [ContactService],
  imports: [TypeOrmModule.forFeature([Contact])],
})
export class ContactModule {}
