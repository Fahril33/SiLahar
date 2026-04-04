
import animeWow from "../assets/sounds/success/anime-wow-sound-effect.mp3";
import kidsCheering from "../assets/sounds/success/kids-cheering-sound-effect-no-copyright-free-to-use.mp3";

import errorMp3 from "../assets/sounds/fail/error_CDOxCYm.mp3";
import faaah from "../assets/sounds/fail/faaah.mp3";
import movie1 from "../assets/sounds/fail/movie_1.mp3";
import spongebobFail from "../assets/sounds/fail/spongebob-fail.mp3";
import vineBoom from "../assets/sounds/fail/vine-boom.mp3";

export type SoundMode = "random" | "specific";

export type SoundConfig = {
  mode: SoundMode;
  specificFile: string | null;
};

export type AppSoundSettings = {
  success: SoundConfig;
  fail: SoundConfig;
};

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

const STORAGE_KEY = "silahar:sound-settings";

export const DEFAULT_SOUND_SETTINGS: AppSoundSettings = {
  success: {
    mode: "random",
    specificFile: null,
  },
  fail: {
    mode: "random",
    specificFile: null,
  },
};

export function loadSoundSettings(): AppSoundSettings {
  if (typeof window === "undefined") return DEFAULT_SOUND_SETTINGS;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_SOUND_SETTINGS;
  try {
    return JSON.parse(stored);
  } catch (e) {
    return DEFAULT_SOUND_SETTINGS;
  }
}

export function saveSoundSettings(settings: AppSoundSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function playSound(type: "success" | "fail", settings: AppSoundSettings) {
  const config = settings[type];
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
    const audio = new Audio(targetUrl);
    audio.play().catch((err) => console.warn("Gagal memutar suara:", err));
  }
}
