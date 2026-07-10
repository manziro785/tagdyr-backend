import { knowledgeCardSchema, type KnowledgeCard } from '@tagdyr/schemas';
import { z } from 'zod';

/**
 * Карточки знаний — финграмотность, вшитая в механику. Открываются событиями
 * (клиент шлёт коды в complete, сервер фиксирует). Собираются за несколько жизней.
 */
const RAW: KnowledgeCard[] = [
  {
    id: 'card_effective_rate',
    code: 'effective_rate',
    title: 'Эффективная ставка',
    category: 'finance',
    body: '«0,1% в день» звучит безобидно — а это 44% в год. Любую ставку переводи в годовую: умножь дневную на 365 и ужаснись заранее, а не потом.',
    season: 1,
  },
  {
    id: 'card_compound_interest',
    code: 'compound_interest',
    title: 'Сложный процент',
    category: 'finance',
    body: 'Проценты начисляются на проценты. 20 000 под 14% через 4 года — уже 33 700. Работает в обе стороны: на долг — против тебя, на накопления — за тебя.',
    season: 2,
  },
  {
    id: 'card_emergency_fund',
    code: 'emergency_fund',
    title: 'Подушка безопасности',
    category: 'finance',
    body: 'Три месячных расхода на отдельном счёте. Это не «лишние деньги» — это право сказать «нет» плохой работе и не занимать при первой же беде.',
    season: 2,
  },
  {
    id: 'card_budget_envelopes',
    code: 'budget_envelopes',
    title: 'Метод конвертов',
    category: 'finance',
    body: 'Зарплата раскладывается по конвертам в день получения: аренда, еда, той, накопления. Что не разложено — то испарилось. Проверено дворами Бишкека.',
    season: 2,
  },
  {
    id: 'card_debt_first',
    code: 'debt_first',
    title: 'Сначала — дорогой долг',
    category: 'finance',
    body: 'Если долгов несколько, гаси сначала тот, где ставка выше — он растёт быстрее всех. Минималки по остальным. Это математика, а не мнение.',
    season: 3,
  },
  {
    id: 'card_income_streams',
    code: 'income_streams',
    title: 'Не один ручей',
    category: 'career',
    body: 'Одна зарплата — один рубильник, который могут выключить. Подработка, навык на продажу, аренда — второй ручей спасает, когда первый пересох.',
    season: 3,
  },
  {
    id: 'card_invest_early',
    code: 'invest_early',
    title: 'Время дороже суммы',
    category: 'finance',
    body: 'Начать откладывать в 20 по чуть-чуть выгоднее, чем в 30 по-крупному: у сложного процента будет на 10 лет больше работы. Лучший день начать был вчера.',
    season: 4,
  },
  {
    id: 'card_social_capital',
    code: 'social_capital',
    title: 'Социальный капитал',
    category: 'relationships',
    body: 'Той, где ты не пожадничал, вернётся помощью, когда прижмёт. Отношения — единственный актив, который не съедает инфляция.',
    season: 1,
  },
  {
    id: 'card_health_asset',
    code: 'health_asset',
    title: 'Здоровье — тоже актив',
    category: 'health',
    body: 'Энергия — валюта, в которой ты платишь за всё остальное. Работать на износ — это брать кредит у собственного тела. Ставка там огромная.',
    season: 4,
  },
  {
    id: 'card_haggle',
    code: 'haggle',
    title: 'Торг уместен',
    category: 'life',
    body: 'На базаре, на собеседовании, в аренде — первая цена не окончательная. Кто спокойно спрашивает «а если подумать?» — экономит годовую зарплату за жизнь.',
    season: 1,
  },
  {
    id: 'card_written_deal',
    code: 'written_deal',
    title: 'Расписка — не обида',
    category: 'life',
    body: 'Деньги в долг даже родне — с распиской. Это не недоверие, это уважение: обе стороны помнят одинаково. Дружба ломается о «я думал, ты подаришь».',
    season: 3,
  },
  {
    id: 'card_scam_radar',
    code: 'scam_radar',
    title: 'Радар на чудо',
    category: 'finance',
    body: '«Гарантированные 10% в месяц» — это не инвестиция, это спектакль, где ты платишь за билет. Чем громче обещание, тем тише уходи.',
    season: 5,
  },
];

export const knowledgeCards: readonly KnowledgeCard[] = z.array(knowledgeCardSchema).parse(RAW);

const byCode = new Map(knowledgeCards.map((k) => [k.code, k]));

export function getKnowledgeCard(code: string): KnowledgeCard | undefined {
  return byCode.get(code);
}
