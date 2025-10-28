const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

export const getCurrentDateBrazil = (): Date => {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');

  return new Date(year, month, day, hour, minute, second);
};

export const formatDateBrazil = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(date);
};

export const formatDateForDisplay = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(dateObj);
};

export const formatDateTimeForDisplay = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return formatter.format(dateObj);
};

export const getFirstDayOfMonthBrazil = (): string => {
  const today = getCurrentDateBrazil();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  return formatDateBrazil(firstDay);
};

export const getLastDayOfMonthBrazil = (): string => {
  const today = getCurrentDateBrazil();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return formatDateBrazil(lastDay);
};

export const getDaysAgoBrazil = (days: number): string => {
  const today = getCurrentDateBrazil();
  const pastDate = new Date(today);
  pastDate.setDate(pastDate.getDate() - days);
  return formatDateBrazil(pastDate);
};

export const getDaysFromNowBrazil = (days: number): string => {
  const today = getCurrentDateBrazil();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + days);
  return formatDateBrazil(futureDate);
};

export const isDateInPeriod = (date: string, startDate: string, endDate: string): boolean => {
  const checkDate = new Date(date + 'T12:00:00-03:00');
  const start = new Date(startDate + 'T00:00:00-03:00');
  const end = new Date(endDate + 'T23:59:59-03:00');

  return checkDate >= start && checkDate <= end;
};

export const getDaysDifference = (date1: string | Date, date2: string | Date): number => {
  const d1 = typeof date1 === 'string' ? new Date(date1 + 'T12:00:00-03:00') : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2 + 'T12:00:00-03:00') : date2;

  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

export const getTodayBrazilForInput = (): string => {
  const today = getCurrentDateBrazil();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateBrazil = (dateString: string): Date => {
  if (dateString.includes('T')) {
    return new Date(dateString);
  }

  const brazilDate = new Date(dateString + 'T12:00:00-03:00');
  return brazilDate;
};

export const formatInputDateForDB = (inputValue: string): string => {
  if (!inputValue) return '';
  return inputValue;
};

export const formatDBDateForInput = (dbDate: string | null): string => {
  if (!dbDate) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(dbDate)) {
    return dbDate;
  }

  const date = new Date(dbDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const formatDBDateForDisplay = (dbDate: string | null): string => {
  if (!dbDate) return '-';

  if (/^\d{4}-\d{2}-\d{2}$/.test(dbDate)) {
    const [year, month, day] = dbDate.split('-');
    return `${day}/${month}/${year}`;
  }

  const date = new Date(dbDate);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};
