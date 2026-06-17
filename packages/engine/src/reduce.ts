import type { LifeState, ChoiceLog } from '@tagdyr/schemas';

/**
 * Заготовка изоморфного редьюсера хода. Полная data-driven реализация
 * (reduce(state, event, choice)) живёт вместе с форматом событий из дизайн-дока,
 * который подключается в фазе 6 вместе с реплей-античитом. Здесь — каркас,
 * чтобы сервер мог прогнать тот же движок по seed + choiceLog (§9).
 *
 * Намеренно НЕ выдумываем формат событий: он придёт из packages/content вместе
 * с пулом событий сезона. Сигнатура зафиксирована, чтобы фаза 6 встала без правок API.
 */

export interface ReplayInput {
  seed: string;
  initialState: LifeState;
  choiceLog: ChoiceLog;
}

export interface ReplayResult {
  finalState: LifeState;
  /** Достижимо ли воспроизведение (false до подключения пула событий). */
  verified: boolean;
}

/**
 * Реплей прохождения сезона по seed + choiceLog. До подключения пула событий
 * (фаза 6) возвращает verified: false — лидерборд на MVP опирается на санити-чек.
 */
export function replaySeason(input: ReplayInput): ReplayResult {
  // TODO(phase-6): прогон reduce() по событиям сезона, сверка финального стейта.
  return { finalState: input.initialState, verified: false };
}
