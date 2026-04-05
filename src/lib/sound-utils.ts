
import animeWow from "../assets/sounds/success/anime-wow-sound-effect.mp3";
import kidsCheering from "../assets/sounds/success/kids-cheering-sound-effect-no-copyright-free-to-use.mp3";

import errorMp3 from "../assets/sounds/fail/error_CDOxCYm.mp3";
import faaah from "../assets/sounds/fail/faaah.mp3";
import movie1 from "../assets/sounds/fail/movie_1.mp3";
import spongebobFail from "../assets/sounds/fail/spongebob-fail.mp3";
import vineBoom from "../assets/sounds/fail/vine-boom.mp3";
import type {
  NotificationSettings,
  NotificationSoundConfig,
} from "../types/notification-settings";

export const SUCCESS_SOUNDS: Record<string, string> = {
  "anime-wow-sound-effect.mp3": animeWow,
  "kids-cheering-sound-effect-no-copyright-free-to-use.mp3": kidsCheering,
};

export const FAIL_SOUNDS: Record<string, string> = {
  "error_CDOxCYm.mp3": errorMp3,
  "faaah.mp3": faaah,
  "movie_1.mp3": movie1,
  "spongebob-fail.mp3": spongebobFail,
  "vine-boom.mp3": vineBoom,
};

const GLOBAL_RULES_STORAGE_KEY = "silahar:notification-settings";

let runtimeNotificationSettings: NotificationSettings | null = null;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  showAdminSoundSettings: false,
  disableSoundResponsesForAllUsers: false,
  success: {
    mode: "random",
    specificFile: null,
  },
  fail: {
    mode: "random",
    specificFile: null,
  },
};

export function loadNotificationSettings(): NotificationSettings {
  if (runtimeNotificationSettings) {
    return runtimeNotificationSettings;
  }

  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_SETTINGS;
  const stored = window.localStorage.getItem(GLOBAL_RULES_STORAGE_KEY);
  if (!stored) return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const parsedRaw = JSON.parse(stored) as Partial<NotificationSettings>;
    const parsed = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...parsedRaw,
      success: {
        ...DEFAULT_NOTIFICATION_SETTINGS.success,
        ...(parsedRaw.success ?? {}),
      },
      fail: {
        ...DEFAULT_NOTIFICATION_SETTINGS.fail,
        ...(parsedRaw.fail ?? {}),
      },
    };
    runtimeNotificationSettings = parsed;
    return parsed;
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export function saveNotificationSettings(settings: NotificationSettings) {
  runtimeNotificationSettings = settings;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    GLOBAL_RULES_STORAGE_KEY,
    JSON.stringify(settings),
  );
}

export function setRuntimeNotificationSettings(settings: NotificationSettings) {
  runtimeNotificationSettings = settings;
}

const audioCache = new Map<string, HTMLAudioElement>();

export function preloadSounds() {
  if (typeof window === "undefined") return;

  const allSounds = { ...SUCCESS_SOUNDS, ...FAIL_SOUNDS };
  Object.values(allSounds).forEach((url) => {
    if (!audioCache.has(url)) {
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.load();
      audioCache.set(url, audio);
    }
  });
}

export function playSound(
  type: "success" | "fail",
  settingsOverride?: Partial<NotificationSettings>,
) {
  const notificationSettings = {
    ...loadNotificationSettings(),
    ...settingsOverride,
    success: {
      ...loadNotificationSettings().success,
      ...(settingsOverride?.success ?? {}),
    },
    fail: {
      ...loadNotificationSettings().fail,
      ...(settingsOverride?.fail ?? {}),
    },
  };
  if (notificationSettings.disableSoundResponsesForAllUsers) {
    return;
  }

  const config = notificationSettings[type] as NotificationSoundConfig;
  const list = type === "success" ? SUCCESS_SOUNDS : FAIL_SOUNDS;
  const filenames = Object.keys(list);

  let targetUrl: string | undefined;

  if (config.mode === "specific" && config.specificFile && list[config.specificFile]) {
    targetUrl = list[config.specificFile];
  } else {
    const randomIndex = Math.floor(Math.random() * filenames.length);
    const randomKey = filenames[randomIndex];
    targetUrl = list[randomKey];
  }

  if (targetUrl) {
    let audio = audioCache.get(targetUrl);
    
    if (!audio) {
      audio = new Audio(targetUrl);
      audioCache.set(targetUrl, audio);
    }

    // Reset current time to allow overlapping or rapid fire play
    audio.currentTime = 0;
    audio.play().catch((err) => console.warn("Gagal memutar suara:", err));
  }
}
