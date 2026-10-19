export function calculateDailyTimeDifferenceMinutes(casesPerDay: number, minutesBefore: number, minutesAfter: number): number {
  return Math.round(casesPerDay * (minutesBefore - minutesAfter));
}

export function formatMinutesAsThaiDuration(value: number): string {
  const minutes = Math.max(0, Math.round(value));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} นาที`;
  if (remainingMinutes === 0) return `${hours} ชั่วโมง`;
  return `${hours} ชั่วโมง ${remainingMinutes} นาที`;
}
