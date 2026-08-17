import { BadRequestException } from '@nestjs/common';
import { ReturnStatus, RmaTicketStatus } from '@prisma/client';
import { RmaTicketsService } from './rma-tickets.service';

describe('RmaTicketsService', () => {
  it('prevents closing a ticket before the linked process is completed', async () => {
    const prisma = {
      rmaTicket: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ticket-1',
          status: RmaTicketStatus.IN_PROGRESS,
          openedAt: new Date(),
          returnRequest: { status: ReturnStatus.PROCESSING },
        }),
      },
    };
    const service = new RmaTicketsService(prisma as any);

    await expect(service.update('ticket-1', { status: RmaTicketStatus.CLOSED }, 'admin-1'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('calculates ticket KPIs using the required status groups', async () => {
    const prisma = {
      rmaTicket: {
        count: jest.fn()
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(5),
        aggregate: jest.fn().mockResolvedValue({ _avg: { resolutionTimeMinutes: 150 } }),
      },
    };
    const service = new RmaTicketsService(prisma as any);

    await expect(service.getKpis()).resolves.toEqual({
      totalTickets: 10,
      openTickets: 4,
      closedTickets: 5,
      resolutionRate: 50,
      averageResolutionTimeMinutes: 150,
    });
    expect(prisma.rmaTicket.count).toHaveBeenNthCalledWith(2, {
      where: { status: { in: [RmaTicketStatus.OPEN, RmaTicketStatus.PENDING, RmaTicketStatus.IN_PROGRESS] } },
    });
  });
});
