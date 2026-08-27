import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { MySupportTicketsController } from './my-support-tickets.controller';
import { SupportTicketsController } from './support-tickets.controller';

const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'USER',
  fullName: 'کاربر آزمون',
} as const;

const ADMIN = {
  id: '22222222-2222-4222-8222-222222222222',
  role: 'SITE_ADMIN',
  fullName: 'ادمین سایت',
} as const;

describe('Support ticket reply controllers', () => {
  it('keeps requester reply routes restricted to USER and AGENCY and delegates with the actor', async () => {
    const service = {
      replyMine: jest.fn().mockResolvedValue({ id: 'ticket-1' }),
    };
    const controller = new MySupportTicketsController(service as never);
    const dto = { body: 'پیگیری مشتری', attachmentIds: [] };

    await expect(controller.reply(USER, 'ticket-1', dto)).resolves.toEqual({
      success: true,
      data: { id: 'ticket-1' },
    });
    expect(service.replyMine).toHaveBeenCalledWith(USER, 'ticket-1', dto);
    expect(Reflect.getMetadata(ROLES_KEY, MySupportTicketsController)).toEqual([
      'USER',
      'AGENCY',
    ]);
  });

  it('keeps staff reply routes restricted to SITE_ADMIN and delegates with the actor', async () => {
    const service = {
      replyAsStaff: jest.fn().mockResolvedValue({ id: 'ticket-1' }),
    };
    const controller = new SupportTicketsController(service as never);
    const dto = { body: 'پاسخ پشتیبانی', attachmentIds: [] };

    await expect(controller.reply(ADMIN, 'ticket-1', dto)).resolves.toEqual({
      success: true,
      data: { id: 'ticket-1' },
    });
    expect(service.replyAsStaff).toHaveBeenCalledWith(ADMIN, 'ticket-1', dto);
    expect(
      // eslint-disable-next-line @typescript-eslint/unbound-method -- decorator metadata is read from the prototype method without invoking it
      Reflect.getMetadata(ROLES_KEY, SupportTicketsController.prototype.reply),
    ).toEqual(['SITE_ADMIN']);
  });
});
