export interface OrgWorkspace {
  workspace: string;
  status: string;
}

export interface OrgRow {
  id: string;
  displayName: string;
  kind: 'INDIVIDUAL' | 'BUSINESS';
  status: string;
  createdAt: string;
  workspaces: OrgWorkspace[];
  memberCount: number;
}

export interface OrgMember {
  id: string;
  userId: string;
  phoneE164: string;
  fullName: string | null;
  role: string;
  status: string;
  joinedAt: string;
}
