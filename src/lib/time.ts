const WITA_TIMEZONE = "Asia/Makassar";
const WITA_UTC_OFFSET = "+08:00";

function toWitaDateObject(dateInput: Date | string) {
  if (dateInput instanceof Date) {
    return dateInput;
  }

  return new Date(`${dateInput}T00:00:00${WITA_UTC_OFFSET}`);
}

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
  }).format(toWitaDateObject(date));
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

export function getWitaDisplayDateUppercase(date: Date | string = new Date()) {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: WITA_TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
    .formatToParts(toWitaDateObject(date))
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`.toUpperCase();
}

export function isWitaFriday(date: Date | string = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: WITA_TIMEZONE,
    weekday: "short",
  }).format(toWitaDateObject(date));

  return weekday === "Fri";
}
