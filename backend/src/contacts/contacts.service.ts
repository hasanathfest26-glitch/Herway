import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateTrustedContactDto, UpdateTrustedContactDto } from './dto/contacts.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.trustedContact.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, dto: CreateTrustedContactDto) {
    return this.prisma.trustedContact.create({
      data: {
        userId,
        name: dto.name,
        relationship: dto.relationship,
        phone: dto.phone,
        email: dto.email,
        canReceiveTripUpdates: dto.canReceiveTripUpdates ?? true,
        canViewLocation: dto.canViewLocation ?? true,
        canReceiveCheckIns: dto.canReceiveCheckIns ?? true,
        canReceiveSos: dto.canReceiveSos ?? true,
      },
    });
  }

  async update(userId: string, contactId: string, dto: UpdateTrustedContactDto) {
    const contact = await this.prisma.trustedContact.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Trusted contact not found');
    if (contact.userId !== userId) throw new ForbiddenException('Not authorized');

    return this.prisma.trustedContact.update({
      where: { id: contactId },
      data: dto,
    });
  }

  async remove(userId: string, contactId: string) {
    const contact = await this.prisma.trustedContact.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Trusted contact not found');
    if (contact.userId !== userId) throw new ForbiddenException('Not authorized');

    await this.prisma.trustedContact.delete({ where: { id: contactId } });
    return { deleted: true, id: contactId };
  }
}
