export interface Settings {
  followUpInterval: number;
  dueSoonThreshold: number;
}

export const DEFAULT_SETTINGS: Settings = {
  followUpInterval: 7,
  dueSoonThreshold: 2
};