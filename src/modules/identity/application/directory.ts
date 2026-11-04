export const IDENTITY_DIRECTORY = Symbol('IdentityDirectory');
export interface DirectoryUser {
  id: string;
  email: string;
  displayName: string;
  status: 'ACTIVE' | 'SUSPENDED';
  emailVerifiedAt: Date;
}
export interface IdentityDirectory {
  getUsers(ids: string[]): Promise<DirectoryUser[]>;
}
