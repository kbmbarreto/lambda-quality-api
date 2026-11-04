import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { IdentityDirectory } from '../application/directory.js';
export class PrismaDirectory implements IdentityDirectory {
  constructor(private readonly client: PrismaClient) {}
  getUsers(ids: string[]) {
    return this.client.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
        emailVerifiedAt: true,
      },
    });
  }
}
