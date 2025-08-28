/**
 * Utilitário para gerenciar datas com timezone do Brasil
 */

// Timezone do Brasil
const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

/**
 * Obtém a data atual no timezone do Brasil
 */
export const getCurrentDateBrazil = (): Date => {
  const now = new Date();
  
  // Usar Intl.DateTimeFormat para conversão precisa
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
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1; // Month is 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');
  
  const brazilTime = new Date(year, month, day, hour, minute, second);
  
  // Log para debug
  console.log('🇧🇷 getCurrentDateBrazil:', {
    utc: now.toISOString(),
    utcFormatted: now.toLocaleDateString('pt-BR'),
    brazilTime: brazilTime.toISOString(),
    brazilFormatted: brazilTime.toLocaleDateString('pt-BR'),
    brazilTimeFormatted: brazilTime.toLocaleTimeString('pt-BR'),
    parts: parts.reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {})
  });
  
  return brazilTime;
};

/**
 * Formata uma data para string no formato YYYY-MM-DD usando timezone do Brasil
 */
export const formatDateBrazil = (date: Date): string => {
  // Usar Intl.DateTimeFormat para conversão precisa
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const formatted = formatter.format(date);
  
  // Log para debug
  console.log('📅 formatDateBrazil:', {
    input: date.toISOString(),
    inputFormatted: date.toLocaleDateString('pt-BR'),
    formatted: formatted,
    formattedDisplay: formatted.split('-').reverse().join('/')
  });
  
  return formatted;
};

/**
 * Formata uma data para exibição no formato brasileiro (DD/MM/YYYY)
 */
export const formatDateForDisplay = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Usar Intl.DateTimeFormat para conversão precisa
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const formatted = formatter.format(dateObj);
  
  // Log para debug
  console.log('🖥️ formatDateForDisplay:', {
    input: typeof date === 'string' ? date : date.toISOString(),
    inputType: typeof date,
    dateObj: dateObj.toISOString(),
    formatted: formatted,
    timezone: BRAZIL_TIMEZONE
  });
  
  return formatted;
};

/**
 * Formata uma data e hora para exibição no formato brasileiro
 */
export const formatDateTimeForDisplay = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Usar Intl.DateTimeFormat para conversão precisa
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const formatted = formatter.format(dateObj);
  
  // Log para debug
  console.log('🕐 formatDateTimeForDisplay:', {
    input: typeof date === 'string' ? date : date.toISOString(),
    dateObj: dateObj.toISOString(),
    formatted: formatted,
    timezone: BRAZIL_TIMEZONE
  });
  
  return formatted;
};

/**
 * Obtém o primeiro dia do mês atual no timezone do Brasil
 */
export const getFirstDayOfMonthBrazil = (): string => {
  const today = getCurrentDateBrazil();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const formatted = formatDateBrazil(firstDay);
  
  // Log para debug
  console.log('📅 getFirstDayOfMonthBrazil:', {
    today: today.toISOString(),
    todayFormatted: today.toLocaleDateString('pt-BR'),
    firstDay: firstDay.toISOString(),
    firstDayFormatted: firstDay.toLocaleDateString('pt-BR'),
    formatted: formatted
  });
  
  return formatted;
};

/**
 * Obtém o último dia do mês atual no timezone do Brasil
 */
export const getLastDayOfMonthBrazil = (): string => {
  const today = getCurrentDateBrazil();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const formatted = formatDateBrazil(lastDay);
  
  // Log para debug
  console.log('📅 getLastDayOfMonthBrazil:', {
    today: today.toISOString(),
    lastDay: lastDay.toISOString(),
    formatted: formatted
  });
  
  return formatted;
};

/**
 * Obtém uma data X dias atrás no timezone do Brasil
 */
export const getDaysAgoBrazil = (days: number): string => {
  const today = getCurrentDateBrazil();
  const pastDate = new Date(today);
  pastDate.setDate(pastDate.getDate() - days);
  const formatted = formatDateBrazil(pastDate);
  
  // Log para debug
  console.log(`📅 getDaysAgoBrazil(${days}):`, {
    today: today.toISOString(),
    todayFormatted: today.toLocaleDateString('pt-BR'),
    pastDate: pastDate.toISOString(),
    pastDateFormatted: pastDate.toLocaleDateString('pt-BR'),
    formatted: formatted
  });
  
  return formatted;
};

/**
 * Obtém uma data X dias no futuro no timezone do Brasil
 */
export const getDaysFromNowBrazil = (days: number): string => {
  const today = getCurrentDateBrazil();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + days);
  const formatted = formatDateBrazil(futureDate);
  
  // Log para debug
  console.log(`📅 getDaysFromNowBrazil(${days}):`, {
    today: today.toISOString(),
    futureDate: futureDate.toISOString(),
    formatted: formatted
  });
  
  return formatted;
};

/**
 * Verifica se uma data está dentro de um período específico (timezone Brasil)
 */
export const isDateInPeriod = (date: string, startDate: string, endDate: string): boolean => {
  const checkDate = new Date(date + 'T12:00:00-03:00');
  const start = new Date(startDate + 'T00:00:00-03:00');
  const end = new Date(endDate + 'T23:59:59-03:00');
  
  const result = checkDate >= start && checkDate <= end;
  
  // Log para debug
  console.log('📅 isDateInPeriod:', {
    date,
    startDate,
    endDate,
    checkDate: checkDate.toISOString(),
    start: start.toISOString(),
    end: end.toISOString(),
    result
  });
  
  return result;
};

/**
 * Calcula diferença em dias entre duas datas (timezone Brasil)
 */
export const getDaysDifference = (date1: string | Date, date2: string | Date): number => {
  const d1 = typeof date1 === 'string' ? new Date(date1 + 'T12:00:00-03:00') : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2 + 'T12:00:00-03:00') : date2;
  
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Log para debug
  console.log('📅 getDaysDifference:', {
    date1: typeof date1 === 'string' ? date1 : date1.toISOString(),
    date2: typeof date2 === 'string' ? date2 : date2.toISOString(),
    d1: d1.toISOString(),
    d2: d2.toISOString(),
    diffDays
  });
  
  return diffDays;
};

/**
 * Obtém a data atual formatada para input date (YYYY-MM-DD) no timezone do Brasil
 */
export const getTodayBrazilForInput = (): string => {
  const today = getCurrentDateBrazil();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const formatted = `${year}-${month}-${day}`;
  
  // Log para debug
  console.log('📅 getTodayBrazilForInput:', {
    today: today.toISOString(),
    todayFormatted: today.toLocaleDateString('pt-BR'),
    year,
    month,
    day,
    formatted,
    currentTime: new Date().toLocaleString('pt-BR', { timeZone: BRAZIL_TIMEZONE })
  });
  
  return formatted;
};

/**
 * Converte uma data string para Date no timezone do Brasil
 */
export const parseDateBrazil = (dateString: string): Date => {
  // Se já tem horário, usar como está
  if (dateString.includes('T')) {
    return new Date(dateString);
  }
  
  // Se é apenas data (YYYY-MM-DD), adicionar horário meio-dia no Brasil
  const brazilDate = new Date(dateString + 'T12:00:00-03:00');
  
  // Log para debug
  console.log('📅 parseDateBrazil:', {
    input: dateString,
    parsed: brazilDate.toISOString(),
    brazilFormatted: brazilDate.toLocaleDateString('pt-BR', { timeZone: BRAZIL_TIMEZONE })
  });
  
  return brazilDate;
};