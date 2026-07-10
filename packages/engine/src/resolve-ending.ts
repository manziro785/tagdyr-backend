import type { Stats, Flags, Debts } from '@tagdyr/schemas';

/**
 * Разрешение глобальной концовки (§6.3 финал). Чистая детерминированная функция
 * от финального состояния жизни — один и тот же код живёт на сервере (finish)
 * и на клиенте (мгновенный показ концовки в гостевом режиме).
 *
 * Правила проверяются по порядку: первое совпавшее — концовка.
 * Коды обязаны существовать в packages/content/endings.
 */
export interface ResolveEndingInput {
  stats: Stats;
  flags: Flags;
  debts: Debts;
}

export function resolveEnding({ stats, flags, debts }: ResolveEndingInput): string {
  const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);
  const has = (key: string) => flags[key] === true;

  // 1. Долги задавили — самая «громкая» концовка, перекрывает остальные.
  //    Порог относительный: умеренный кредит при деньгах — не приговор.
  if (totalDebt > Math.max(30_000, stats.money * 1.5)) return 'debt_trap';

  // 2. Выгорание: пустая батарейка важнее достижений
  if (stats.energy <= 20 || stats.mood <= 20) return 'burnout';

  // 3. Свой бизнес (точка на Дордое доросла до дела жизни)
  if (has('hasBusiness')) return 'entrepreneur';

  // 4. Академическая дорога
  if (has('masterDegree') || (has('higherEd') && has('academicPath'))) return 'scholar';

  // 5. Уехал и не вернулся
  if (has('wentAbroad') && !has('returnedHome')) return 'wanderer';

  // 6. Вернулся к корням
  if (has('backToVillage')) return 'mountain_soul';

  // 7. Мастер своего дела
  if (has('craftsman')) return 'golden_hands';

  // 8. Опора семьи — держится на отношениях
  if (stats.relationships >= 70 && has('familyFirst')) return 'support';

  // 9. Душа компании и двора
  if (stats.mood >= 75 && stats.relationships >= 60) return 'local_star';

  // 10. Крепкий середняк — достойный дефолт, не «проигрыш»
  return 'steady';
}
