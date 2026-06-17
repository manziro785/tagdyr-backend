import { characterSchema, type Character } from '@tagdyr/schemas';
import { z } from 'zod';

/**
 * Стартовый ростер. На MVP контент статичен (бандлится в клиент, §8).
 * Все записи валидируются схемой на загрузке — единый источник правды.
 */
const RAW: Character[] = [
  {
    id: 'char_aibek',
    code: 'aibek',
    name: 'Айбек',
    age: 17,
    description: 'Парень из небольшого города, мечтает вырваться и встать на ноги.',
    startStats: { money: 5000, energy: 80, mood: 60, relationships: 50 },
    unlockCondition: null,
    isUnlockable: false,
  },
  {
    id: 'char_aizhan',
    code: 'aizhan',
    name: 'Айжан',
    age: 17,
    description: 'Дочь учителей, отличница, выбирает между долгом перед семьёй и своей мечтой.',
    startStats: { money: 3000, energy: 70, mood: 70, relationships: 65 },
    unlockCondition: null,
    isUnlockable: false,
  },
  {
    id: 'char_marat',
    code: 'marat',
    name: 'Марат',
    age: 17,
    description: 'Вырос в достатке, но без опоры внутри. Разблокируется за концовку «Опора».',
    startStats: { money: 20000, energy: 60, mood: 50, relationships: 40 },
    unlockCondition: 'ending:support',
    isUnlockable: true,
  },
];

export const characters: readonly Character[] = z.array(characterSchema).parse(RAW);

const byId = new Map(characters.map((c) => [c.id, c]));

export function getCharacter(id: string): Character | undefined {
  return byId.get(id);
}
