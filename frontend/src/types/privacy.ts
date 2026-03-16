/**
 * Privacy meta types — contract §8.
 */
export interface PrivacyPermission {
  name: string;
  description: string;
  required: boolean;
}

export interface PrivacyMeta {
  permissions: PrivacyPermission[];
  data_collected: string[];
  data_not_collected: string[];
}
