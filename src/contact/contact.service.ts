import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './contact.entity';
import { IdentifyRequestDto, IdentifyResponseDto } from './dto/identify.dto';

@Injectable()
export class ContactService {
  logger = new Logger(ContactService.name);
  constructor(
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
  ) {}

  private async findContactsByEmailOrPhone({
    email,
    phoneNumber,
  }: Pick<Contact, 'email' | 'phoneNumber'>): Promise<Contact[]> {
    return await this.contactRepository
      .createQueryBuilder('contact')
      .where('contact.email = :email OR contact.phoneNumber = :phoneNumber', {
        email,
        phoneNumber,
      })
      .andWhere('contact.deletedAt IS NULL')
      .orderBy('contact.createdAt', 'ASC')
      .getMany();
  }

  private async saveContact(contact: Contact): Promise<Contact> {
    return await this.contactRepository.save(contact);
  }

  private async findOtherPrimaryContacts({
    email,
    phoneNumber,
    id,
  }: Pick<Contact, 'phoneNumber' | 'email' | 'id'>): Promise<Contact[]> {
    return await this.contactRepository
      .createQueryBuilder('contact')
      .where('contact.email = :email OR contact.phoneNumber = :phoneNumber', {
        email,
        phoneNumber,
      })
      .andWhere('contact.linkPrecedence = :precedence', {
        precedence: 'primary',
      })
      .andWhere('contact.id != :id', {
        id,
      })
      .andWhere('contact.deletedAt IS NULL')
      .getMany();
  }

  private async findAllRelatedContacts(
    primaryId: Contact['id'],
  ): Promise<Contact[]> {
    return await this.contactRepository
      .createQueryBuilder('contact')
      .where('contact.id = :id OR contact.linkedId = :id', {
        id: primaryId,
      })
      .andWhere('contact.deletedAt IS NULL')
      .orderBy('contact.createdAt', 'ASC')
      .getMany();
  }

  private create(data: Partial<Contact>): Contact {
    return this.contactRepository.create(data);
  }

  private hasNewInfo(
    contacts: Contact[],
    { email, phoneNumber }: Pick<Contact, 'email' | 'phoneNumber'>,
  ): boolean {
    return (
      (email && !contacts.some((c) => c.email === email)) ||
      (phoneNumber && !contacts.some((c) => c.phoneNumber === phoneNumber))
    );
  }

  private determinePrimaryContact(contacts: Contact[]): Contact {
    const primary = contacts.find((c) => c.linkPrecedence === 'primary');
    if (primary) return primary;
    const earliest = contacts.reduce((earliest, current) =>
      earliest.createdAt < current.createdAt ? earliest : current,
    );
    return { ...earliest, linkPrecedence: 'primary' };
  }

  private consolidateContacts(
    allContacts: Contact[],
    primaryContact: Contact,
  ): IdentifyResponseDto {
    const emails = Array.from(
      new Set(allContacts.map((c) => c.email).filter(Boolean)),
    );
    const phoneNumbers = Array.from(
      new Set(allContacts.map((c) => c.phoneNumber).filter(Boolean)),
    );
    const secondaryContactIds = allContacts
      .filter((c) => c.linkPrecedence === 'secondary')
      .map((c) => c.id);

    // Ensure primary contact's email and phoneNumber are first
    if (primaryContact.email && emails.includes(primaryContact.email)) {
      emails.splice(emails.indexOf(primaryContact.email), 1);
      emails.unshift(primaryContact.email);
    }
    if (
      primaryContact.phoneNumber &&
      phoneNumbers.includes(primaryContact.phoneNumber)
    ) {
      phoneNumbers.splice(phoneNumbers.indexOf(primaryContact.phoneNumber), 1);
      phoneNumbers.unshift(primaryContact.phoneNumber);
    }

    return {
      contact: {
        primaryContatctId: primaryContact.id,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    };
  }

  private reassignPrimaryContacts(
    otherPrimaryContacts: Contact[],
    earliestPrimary: Contact,
  ): Contact[] {
    return otherPrimaryContacts
      .filter((c) => c.id !== earliestPrimary.id)
      .map((c) => ({
        ...c,
        linkPrecedence: 'secondary',
        linkedId: earliestPrimary.id,
        updatedAt: new Date(),
      }));
  }

  async identify(data: IdentifyRequestDto): Promise<IdentifyResponseDto> {
    const { email, phoneNumber } = data;

    // Validate input
    if (!email && !phoneNumber) {
      this.logger.error(
        'Identification failed: No email or phone number provided',
        JSON.stringify(data),
      );
      throw new BadRequestException(
        'At least one of email or phoneNumber must be provided',
      );
    }

    try {
      // Find matching contacts
      const contacts = await this.findContactsByEmailOrPhone({
        email,
        phoneNumber,
      });
      this.logger.log(
        `Found ${contacts.length} contacts for email: ${email}, phoneNumber: ${phoneNumber}`,
      );

      // Handle no contacts found
      if (!contacts.length) {
        const newContact = this.create({
          email,
          phoneNumber,
          linkPrecedence: 'primary',
        });
        this.logger.log(
          `No existing contacts found. Creating new contact for email: ${email}, phoneNumber: ${phoneNumber}`,
        );
        const savedContact = await this.saveContact(newContact);
        return this.consolidateContacts([savedContact], savedContact);
      }

      // Determine primary contact
      let primaryContact = this.determinePrimaryContact(contacts);
      if (primaryContact.linkPrecedence !== contacts[0].linkPrecedence) {
        this.logger.log(`Assigning ${primaryContact.id} as primary contact`);
        await this.saveContact(primaryContact);
      }

      // Create new secondary contact if needed
      if (this.hasNewInfo(contacts, { email, phoneNumber })) {
        const newContact = this.create({
          email,
          phoneNumber,
          linkedId: primaryContact.id,
          linkPrecedence: 'secondary',
        });
        this.logger.log(
          `Creating new secondary contact for email: ${email}, phoneNumber: ${phoneNumber}`,
        );
        const savedContact = await this.saveContact(newContact);
        contacts.push(savedContact);
      }

      // Handle other primary contacts
      const otherPrimaryContacts = await this.findOtherPrimaryContacts({
        email,
        phoneNumber,
        id: primaryContact.id,
      });

      if (otherPrimaryContacts.length) {
        const earliestPrimary = contacts.reduce((earliest, current) =>
          earliest.createdAt < current.createdAt ? earliest : current,
        );
        const contactsToUpdate = this.reassignPrimaryContacts(
          otherPrimaryContacts,
          earliestPrimary,
        );
        // Update all other primary contacts to secondary
        await Promise.all(
          contactsToUpdate.map((contact) => this.saveContact(contact)),
        );
      }

      // Fetch all related contacts for response
      const allContacts = await this.findAllRelatedContacts(primaryContact.id);

      // Return consolidated response
      return this.consolidateContacts(allContacts, primaryContact);
    } catch (error) {
      // Handle unexpected errors
      if (error instanceof BadRequestException) {
        throw error; // Re-throw validation errors
      }
      this.logger.error('Error during contact identification', error);
      throw new InternalServerErrorException(
        `An error occurred while processing the request: ${error.message}`,
      );
    }
  }
}
