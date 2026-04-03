export const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
export const BRAZIL_LOCALE = "pt-BR";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatDateBR(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  },
) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString(BRAZIL_LOCALE, {
    timeZone: BRAZIL_TIME_ZONE,
    ...options,
  });
}

export function formatDateTimeBR(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleString(BRAZIL_LOCALE, {
    timeZone: BRAZIL_TIME_ZONE,
    ...options,
  });
}

export function formatMonthNameBR(month: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12) return "";
  const date = new Date(Date.UTC(2026, month - 1, 1));
  return new Intl.DateTimeFormat(BRAZIL_LOCALE, {
    month: "long",
    timeZone: BRAZIL_TIME_ZONE,
  }).format(date);
}
