import dayjs, { Dayjs } from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat'
import utc from 'dayjs/plugin/utc'
dayjs.extend(advancedFormat)
dayjs.extend(utc)

export function combineIntoUTCDate(date: Date, timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);

  const localDate = dayjs(date)
    .hour(hours)
    .minute(minutes)
    .second(0)
    .millisecond(0);

  return localDate.utc().toDate();
}

export function utcToLocal(date: Date | Dayjs | string | undefined | null) {
  if (!date) return null;
  return dayjs.utc(date).local();
}

export function prettyDate(date: Date | Dayjs | string | undefined | null) : string {
  if (!date) return '';
  return dayjs(date).format('MMMM Do, YYYY');
}

export function prettyTime(date: Date | Dayjs | string | undefined | null) : string {
  if (!date) return '';
  return dayjs(date).format('h:mma');
}

export function prettyShortDate(date: Date | Dayjs | string | undefined | null) : string {
  if (!date) return '';
  return dayjs(date).format('dddd, MMMM Do');
}

export function formatDuration(from: string, to: string | undefined | null) : string {
  if (!from || !to) return '';
  const minutes = Math.abs(dayjs(to).diff(dayjs(from), 'minute'));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  let result = '';
  if (hours) result += `${hours} hour${hours > 1 ? 's' : ''} `;
  if (remainingMinutes) result += `${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
  return result.trim();
}
