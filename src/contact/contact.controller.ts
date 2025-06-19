import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { IdentifyRequestDto, IdentifyResponseDto } from './dto/identify.dto';

@Controller('')
export class ContactController {
  logger = new Logger(ContactController.name);
  constructor(private readonly contactService: ContactService) {}

  @Post('/identify')
  async identify(
    @Body() body: IdentifyRequestDto,
  ): Promise<IdentifyResponseDto> {
    try {
      this.logger.log(
        `Received contact identification request: body=${JSON.stringify(body)}`,
      );

      const response = await this.contactService.identify(body);
      this.logger.log(
        'Contact identification request processed successfully',
        JSON.stringify(response),
      );
      return response;
    } catch (error) {
      this.logger.error(
        'Error processing contact identification request',
        error.message,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new HttpException(
        'Failed to process contact identification request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
