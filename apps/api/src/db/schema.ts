import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  jsonb,
  date,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import type { Stats, Flags, Debts, KeyDecision } from '@tagdyr/schemas';

// ── enums ─────────────────────────────────────────────────────────────────────

export const lifeStatusEnum = pgEnum('life_status', ['active', 'finished', 'archived']);
export const localeEnum = pgEnum('locale', ['ru', 'ky']);

// ── users ─────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(), // google / telegram / email
    providerId: text('provider_id').notNull(),
    email: text('email'),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    locale: localeEnum('locale').notNull().default('ru'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerUniq: uniqueIndex('users_provider_uniq').on(t.provider, t.providerId),
  }),
);

// ── lives — слот жизни + актуальный LifeState (быстрое чтение) ─────────────────

export const lives = pgTable(
  'lives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slotIndex: integer('slot_index').notNull(), // 0..2
    characterId: text('character_id').notNull(),
    status: lifeStatusEnum('status').notNull().default('active'),
    currentSeason: integer('current_season').notNull().default(1),
    age: integer('age').notNull(),
    stats: jsonb('stats').$type<Stats>().notNull(),
    flags: jsonb('flags').$type<Flags>().notNull().default({}),
    debts: jsonb('debts').$type<Debts>().notNull().default([]),
    seed: text('seed').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // один слот на пользователя уникален
    userSlotUniq: uniqueIndex('lives_user_slot_uniq').on(t.userId, t.slotIndex),
    userIdx: index('lives_user_idx').on(t.userId),
  }),
);

// ── life_snapshots — слепок на конец сезона ───────────────────────────────────

export const lifeSnapshots = pgTable(
  'life_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lifeId: uuid('life_id')
      .notNull()
      .references(() => lives.id, { onDelete: 'cascade' }),
    seasonNumber: integer('season_number').notNull(),
    age: integer('age').notNull().default(0),
    stats: jsonb('stats').$type<Stats>().notNull(),
    flags: jsonb('flags').$type<Flags>().notNull(),
    debts: jsonb('debts').$type<Debts>().notNull(),
    keyDecisions: jsonb('key_decisions').$type<KeyDecision[]>().notNull().default([]),
    diary: jsonb('diary').$type<string[]>().notNull().default([]),
    seasonOutcome: text('season_outcome').notNull().default(''),
    epilogue: text('epilogue'),
    seed: text('seed').notNull(),
    /** Ключ идемпотентности завершения сезона (Idempotency-Key или seed). */
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // один снапшот на (жизнь, сезон) — основа идемпотентности и отката
    lifeSeasonUniq: uniqueIndex('snapshots_life_season_uniq').on(t.lifeId, t.seasonNumber),
    idemUniq: uniqueIndex('snapshots_idem_uniq').on(t.lifeId, t.idempotencyKey),
    lifeIdx: index('snapshots_life_idx').on(t.lifeId),
  }),
);

// ── season_results — для лидербордов/перцентилей ──────────────────────────────

export const seasonResults = pgTable(
  'season_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lifeId: uuid('life_id')
      .notNull()
      .references(() => lives.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    seasonNumber: integer('season_number').notNull(),
    lifeIndex: numeric('life_index', { precision: 12, scale: 4 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // один результат на (жизнь, сезон); переигровка обновляет его
    lifeSeasonUniq: uniqueIndex('results_life_season_uniq').on(t.lifeId, t.seasonNumber),
    seasonIdx: index('results_season_idx').on(t.seasonNumber),
    rankIdx: index('results_season_index_idx').on(t.seasonNumber, t.lifeIndex),
  }),
);

// ── коллекции пользователя (M—N) ──────────────────────────────────────────────

export const userKnowledgeCards = pgTable(
  'user_knowledge_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardId: text('card_id').notNull(),
    lifeId: uuid('life_id').references(() => lives.id, { onDelete: 'set null' }),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCardUniq: uniqueIndex('user_cards_uniq').on(t.userId, t.cardId),
  }),
);

export const userEndings = pgTable(
  'user_endings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endingId: text('ending_id').notNull(),
    lifeId: uuid('life_id').references(() => lives.id, { onDelete: 'set null' }),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userEndingUniq: uniqueIndex('user_endings_uniq').on(t.userId, t.endingId),
  }),
);

export const userCharacters = pgTable(
  'user_characters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    characterId: text('character_id').notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCharUniq: uniqueIndex('user_characters_uniq').on(t.userId, t.characterId),
  }),
);

// ── дилемма дня ───────────────────────────────────────────────────────────────

export const dailyDilemmas = pgTable(
  'daily_dilemmas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date').notNull(),
    prompt: text('prompt').notNull(),
    options: jsonb('options').$type<string[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dateUniq: uniqueIndex('dilemmas_date_uniq').on(t.date),
  }),
);

export const dilemmaAnswers = pgTable(
  'dilemma_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dilemmaId: uuid('dilemma_id')
      .notNull()
      .references(() => dailyDilemmas.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    choiceIndex: integer('choice_index').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    answerUniq: uniqueIndex('dilemma_answers_uniq').on(t.dilemmaId, t.userId),
  }),
);

// ── share-токены (публичный безопасный срез жизни) ────────────────────────────

export const shareTokens = pgTable(
  'share_tokens',
  {
    token: text('token').primaryKey(), // nanoid/uuid, неперебираемый
    lifeId: uuid('life_id')
      .notNull()
      .references(() => lives.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    lifeIdx: index('share_life_idx').on(t.lifeId),
  }),
);

// удобные типы для кода
export type UserRow = typeof users.$inferSelect;
export type LifeRow = typeof lives.$inferSelect;
export type LifeSnapshotRow = typeof lifeSnapshots.$inferSelect;
export type SeasonResultRow = typeof seasonResults.$inferSelect;
