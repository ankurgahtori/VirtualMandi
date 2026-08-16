import { IST_TIME_ZONE } from '../constants/locales.js';

export const toIsoString = (value: Date): string => value.toISOString();

export const getIstDateKey = (value: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${fields.year}-${fields.month}-${fields.day}`;
};
