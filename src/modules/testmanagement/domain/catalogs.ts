export const FIELD_TYPES = [
  'TEXT',
  'NUMBER',
  'BOOLEAN',
  'DATE',
  'SINGLE_SELECT',
] as const;
export interface FieldOption {
  id: string;
  label: string;
}
export interface CustomFieldDefinition {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  type: (typeof FIELD_TYPES)[number];
  target: 'TEST_CASE';
  required: boolean;
  position: number;
  options: FieldOption[];
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface Tag {
  id: string;
  workspaceId: string;
  name: string;
  normalizedName: string;
  createdAt: Date;
  updatedAt: Date;
}
