import { IsString, IsOptional, IsEmail, Matches } from 'class-validator';

export class IdentifyRequestDto {
  @IsOptional()
  @IsString()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message:
      'Invalid phone number format. Must be a valid phone number (e.g., +1234567890)',
  })
  phoneNumber?: string;
}

export class IdentifyResponseDto {
  contact: {
    primaryContatctId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}
