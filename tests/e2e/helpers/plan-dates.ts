import { formatIstanbulIsoDate } from "../../../lib/formatters";

export function istanbulDateForOffset(daysAhead = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return formatIstanbulIsoDate(date);
}

export function activePlanStartDate() {
  return istanbulDateForOffset(0);
}

export function futureIstanbulDate(daysAhead = 7) {
  return istanbulDateForOffset(daysAhead);
}
