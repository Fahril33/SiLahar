export type NotificationSoundMode = "random" | "specific";

export type NotificationSoundConfig = {
  mode: NotificationSoundMode;
  specificFile: string | null;
};

export type NotificationSettings = {
  showAdminSoundSettings: boolean;
  disableSoundResponsesForAllUsers: boolean;
  success: NotificationSoundConfig;
  fail: NotificationSoundConfig;
};
