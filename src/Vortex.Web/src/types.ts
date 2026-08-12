export type AccessMode = "Public" | "Restricted" | 0 | 1;

export interface Application {
  key: string;
  displayName: string;
  launchUrl: string;
  accessMode: AccessMode;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationDetail extends Application {
  userSubjects: string[];
  roles: string[];
}

export interface Profile {
  subject: string | null;
  name: string | null;
  roles: string[];
}

export interface UserAccessLog {
  id: string;
  subject: string;
  userName: string | null;
  applicationKey: string | null;
  applicationName: string | null;
  action: string;
  roles: string[];
  ipAddress: string | null;
  timestamp: string;
}

export interface UserAccessMatrixItem {
  subject: string;
  userName: string | null;
  roles: string[];
  accessibleApplicationKeys: string[];
  lastActiveAt: string;
}

