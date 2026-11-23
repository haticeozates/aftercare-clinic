import { share, type PeriodCounts } from "./contracts";

export const periodMetrics = {
  appointments: ["Toplam randevu", "Seçilen tarihlerde başlangıcı olan randevular. Tüm durumlar dahildir."],
  completed: ["Tamamlanan randevu", "Başlangıcı dönemde olan ve tamamlandı durumundaki randevular."],
  pending: ["Onay bekleyen randevu", "Başlangıcı dönemde olan ve onay bekleyen randevular."],
  cancellation: ["İptal oranı", "Dönemdeki iptaller / sonuçlanmış randevular. Sonuçlar tamamlandı, iptal ve gelmedi durumlarıdır."],
  absence: ["Gelmeme oranı", "Dönemdeki gelmedi kayıtları / sonuçlanmış randevular."],
  followups: ["Dönemdeki kontrol randevusu", "Başlangıcı dönemde olan kontrol randevuları. Randevu filtrelerine tabidir."],
  taskAdherence: ["Görev tamamlama oranı", "Tamamlanan / vadesi gelen zorunlu, bilgi dışındaki ve atlanmamış görevler. Bakım günü İstanbul saatine göre belirlenir."],
  checkinAdherence: ["Check-in katılım oranı", "Gönderim olan / vadesi gelen ve check-in seçeneği olan plan günleri. Günde en fazla bir gönderim sayılır."],
} as const;

export function metricValues(period: PeriodCounts) {
  const { appointments: a, tasks, checkins } = period;
  return {
    appointments: { value: a.total, count: a.total },
    completed: { value: a.completed, count: a.completed },
    pending: { value: a.pending, count: a.pending },
    cancellation: { value: share(a.cancelled, a.terminal), numerator: a.cancelled, denominator: a.terminal },
    absence: { value: share(a.no_show, a.terminal), numerator: a.no_show, denominator: a.terminal },
    followups: { value: a.follow_ups, count: a.follow_ups },
    taskAdherence: { value: share(tasks.done, tasks.due), numerator: tasks.done, denominator: tasks.due },
    checkinAdherence: { value: share(checkins.done, checkins.due), numerator: checkins.done, denominator: checkins.due },
  };
}
