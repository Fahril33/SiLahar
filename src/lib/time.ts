const WITA_TIMEZONE = "Asia/Makassar";

export function getWitaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WITA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatWitaDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WITA_TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00+08:00`));
}

export function formatWitaDateTime(dateTime: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WITA_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateTime));
}

export function nowIso() {
  return new Date().toISOString();
}

export function getWitaDisplayDateUppercase(date = new Date()) {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: WITA_TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`.toUpperCase();
}

export function isWitaFriday(date = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: WITA_TIMEZONE,
    weekday: "short",
  }).format(date);

  return weekday === "Fri";
}
