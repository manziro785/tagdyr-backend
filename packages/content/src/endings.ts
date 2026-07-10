import { endingSchema, type Ending } from '@tagdyr/schemas';
import { z } from 'zod';

/**
 * Галерея концовок. Код разрешается движком (resolveEnding) из финального
 * состояния — здесь только витрина: заголовок, архетип, описание, бонус к индексу.
 */
const RAW: Ending[] = [
  {
    id: 'ending_entrepreneur',
    code: 'entrepreneur',
    title: 'Предприниматель',
    archetype: 'Дело',
    description:
      'Начал с контейнера на Дордое — закончил своим делом. Теперь родня занимает у тебя, и ты даёшь без процентов.',
    bonus: 8,
  },
  {
    id: 'ending_support',
    code: 'support',
    title: 'Опора',
    archetype: 'Семья',
    description:
      'Ты тот, кому звонят первым — и в беде, и на той. Не самый богатый, зато за твоим дасторконом всегда людно.',
    bonus: 8,
  },
  {
    id: 'ending_scholar',
    code: 'scholar',
    title: 'Учёный',
    archetype: 'Знание',
    description:
      'Пока другие считали выручку, ты считал формулы. Магистратура, конференции — и студенты, которые зовут тебя «агай».',
    bonus: 7,
  },
  {
    id: 'ending_wanderer',
    code: 'wanderer',
    title: 'Кочевник',
    archetype: 'Дорога',
    description:
      'Москва, Алматы, дальше — больше. Переводы домой приходят исправно, а вот сам ты — всё реже. Горы снятся по ночам.',
    bonus: 5,
  },
  {
    id: 'ending_mountain_soul',
    code: 'mountain_soul',
    title: 'Душа гор',
    archetype: 'Корни',
    description:
      'Город попробовал — не зашло. Вернулся, поставил юрту для туристов, и утро начинается с гор, а не с маршрутки.',
    bonus: 6,
  },
  {
    id: 'ending_golden_hands',
    code: 'golden_hands',
    title: 'Золотые руки',
    archetype: 'Ремесло',
    description:
      'Твои руки помнят каждый болт Бишкека. Мастера с таким именем в очередь не ставят — к нему записываются.',
    bonus: 6,
  },
  {
    id: 'ending_local_star',
    code: 'local_star',
    title: 'Своя звезда',
    archetype: 'Люди',
    description:
      'Не богат, не знаменит — но во дворе без тебя не начинается ни один той. Быть любимым — тоже капитал.',
    bonus: 5,
  },
  {
    id: 'ending_steady',
    code: 'steady',
    title: 'Крепкий середняк',
    archetype: 'Стабильность',
    description:
      'Без взлётов и падений: работа, дом, копейка на чёрный день. Кто-то скажет «скучно» — ты скажешь «спокойно».',
    bonus: 4,
  },
  {
    id: 'ending_burnout',
    code: 'burnout',
    title: 'Выгоревший',
    archetype: 'Урок',
    description:
      'Всё успевал, всем помогал, себя — забыл. Батарейка села на самом интересном месте. В следующей жизни — беречь энергию.',
    bonus: 2,
  },
  {
    id: 'ending_debt_trap',
    code: 'debt_trap',
    title: 'Долговая яма',
    archetype: 'Урок',
    description:
      'Проценты росли, пока ты спал. 20 000 стали 60 000, и половина зарплаты уходит «на вчера». Сложный процент работает и против тебя.',
    bonus: 2,
  },
];

export const endings: readonly Ending[] = z.array(endingSchema).parse(RAW);

const byCode = new Map(endings.map((e) => [e.code, e]));

export function getEnding(code: string): Ending | undefined {
  return byCode.get(code);
}
