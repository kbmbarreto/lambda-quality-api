import type { IdentityDirectory } from '../application/directory.js';
import type { IdentityStore } from '../application/ports.js';
export class StoreDirectory implements IdentityDirectory {
  constructor(private readonly store: IdentityStore) {}
  async getUsers(ids: string[]) {
    const users = await Promise.all(
      [...new Set(ids)].map((id) => this.store.findUserById(id)),
    );
    return users.flatMap((user) =>
      user
        ? [
            {
              id: user.id,
              email: user.email,
              displayName: user.displayName,
              status: user.status,
              emailVerifiedAt: user.emailVerifiedAt,
            },
          ]
        : [],
    );
  }
}
