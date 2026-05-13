import { z } from 'zod'
import { SUPPORTED_META_VERBS, SUPPORTED_VERBS } from '../engine/parser'
import { RESOLVE_LEVELS } from '../engine/types'

const stateValueSchema = z.union([z.string(), z.boolean(), z.number(), z.array(z.string())])
const stateRecordSchema = z.record(z.string(), stateValueSchema)
const directionSchema = z.enum(['n', 's', 'e', 'w', 'u', 'd'])
const verbSchema = z.enum(SUPPORTED_VERBS)
const metaVerbSchema = z.enum(SUPPORTED_META_VERBS)
const aliasListSchema = z.array(z.string().trim().min(1)).min(1)
const lightBurnTriggerSchema = z.enum(['move', 'wait'])
const resolveLevelSchema = z.enum(RESOLVE_LEVELS)
const resolveCostSchema = z.union([z.literal(0), z.literal(1), z.literal(2)])

export const gameFrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  startingRoom: z.string().min(1),
  startingInventory: z.array(z.string().min(1)).default([]),
  endingPriority: z.array(z.string().min(1)).min(1),
  transcriptCap: z.number().int().positive().optional(),
})

export type GameFrontmatter = z.infer<typeof gameFrontmatterSchema>

export const parserFrontmatterSchema = z.object({
  directions: z.record(directionSchema, aliasListSchema),
  prepositions: aliasListSchema,
  stopWords: z.array(z.string().trim().min(1)).default([]),
  noTargetVerbs: z.array(verbSchema).default([]),
  metaVerbs: z.array(metaVerbSchema).default([]),
  verbs: z.partialRecord(verbSchema, aliasListSchema),
}).superRefine((value, ctx) => {
  for (const direction of directionSchema.options) {
    if (!value.directions[direction]?.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['directions', direction],
        message: `directions.${direction} must define at least one alias`,
      })
    }
  }
})

export type ParserFrontmatter = z.infer<typeof parserFrontmatterSchema>

export const uiFrontmatterSchema = z.object({
  pageTitle: z.string().trim().min(1),
  description: z.string().trim().min(1),
  robots: z.string().trim().min(1).default('noindex'),
  themeColor: z.string().trim().min(1).default('#1a0d00'),
  footer: z.object({
    copyright: z.string().trim().min(1),
    copyrightHref: z.url().optional(),
    buildLabel: z.string().trim().min(1).default('Build #'),
    showBuild: z.boolean().default(true),
    links: z.array(z.object({
      label: z.string().trim().min(1),
      href: z.url(),
    })).default([]),
  }),
  features: z.object({
    chips: z.boolean().default(true),
    lightMeter: z.boolean().default(true),
    typedEffect: z.boolean().default(true),
    roomScroll: z.boolean().default(true),
  }).default({
    chips: true,
    lightMeter: true,
    typedEffect: true,
    roomScroll: true,
  }),
})

export type UiFrontmatter = z.infer<typeof uiFrontmatterSchema>

export const lightMechanicFrontmatterSchema = z.object({
  enabled: z.boolean().default(true),
  handler: z.literal('light').default('light'),
  maxTurns: z.number().int().positive().default(6),
  burnOn: z.array(lightBurnTriggerSchema).default(['move', 'wait']),
  stateKeys: z.object({
    lit: z.string().trim().min(1).default('lit'),
    burn: z.string().trim().min(1).default('burn'),
  }).default({ lit: 'lit', burn: 'burn' }),
  ui: z.object({
    meter: z.boolean().default(true),
    icon: z.string().trim().min(1).default('candle'),
  }).default({ meter: true, icon: 'candle' }),
})

export type LightMechanicFrontmatter = z.infer<typeof lightMechanicFrontmatterSchema>

export const resolveMechanicFrontmatterSchema = z.object({
  enabled: z.boolean().default(true),
  handler: z.literal('resolve').default('resolve'),
  ladder: z.array(resolveLevelSchema).min(1).default([...RESOLVE_LEVELS]),
  wrongVerbCost: resolveCostSchema.default(1),
  safeRooms: z.object({
    recoverySteps: z.number().int().nonnegative().default(1),
  }).default({ recoverySteps: 1 }),
  failure: z.object({
    retreatAt: resolveLevelSchema.default('returning'),
    afterRetreat: resolveLevelSchema.default('shaken'),
  }).default({ retreatAt: 'returning', afterRetreat: 'shaken' }),
}).superRefine((value, ctx) => {
  const seen = new Set(value.ladder)
  if (seen.size !== value.ladder.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['ladder'],
      message: 'ladder entries must be unique',
    })
  }
  if (!seen.has(value.failure.retreatAt)) {
    ctx.addIssue({
      code: 'custom',
      path: ['failure', 'retreatAt'],
      message: 'failure.retreatAt must be present in ladder',
    })
  }
  if (!seen.has(value.failure.afterRetreat)) {
    ctx.addIssue({
      code: 'custom',
      path: ['failure', 'afterRetreat'],
      message: 'failure.afterRetreat must be present in ladder',
    })
  }
})

export type ResolveMechanicFrontmatter = z.infer<typeof resolveMechanicFrontmatterSchema>

const actionHandlerSchema = z.enum(['drunk-transition'])

export const actionFrontmatterSchema = z.object({
  id: z.string().min(1),
  verbs: z.array(verbSchema).min(1),
  handler: actionHandlerSchema.optional(),
  requires: z.object({
    allHeld: z.array(z.string().min(1)).min(1).optional(),
    allVisibleOrHeld: z.array(z.string().min(1)).min(1).optional(),
  }).optional(),
  consumes: z.object({
    inventory: z.array(z.string().min(1)).default([]),
  }).optional(),
  decrements: z.object({
    item: z.string().min(1),
    stateKey: z.string().min(1),
  }).optional(),
  setsFlags: stateRecordSchema.optional(),
  drunkTransition: z.object({
    destinationRoom: z.string().min(1),
    maxMoves: z.number().int().positive(),
    wakeRoom: z.string().min(1),
    resetRoom: z.string().min(1),
  }).optional(),
}).superRefine((value, ctx) => {
  if (value.handler === 'drunk-transition' && !value.drunkTransition) {
    ctx.addIssue({
      code: 'custom',
      path: ['drunkTransition'],
      message: 'drunkTransition is required when handler is drunk-transition',
    })
  }
  if (value.handler !== 'drunk-transition' && value.drunkTransition) {
    ctx.addIssue({
      code: 'custom',
      path: ['drunkTransition'],
      message: 'drunkTransition is only supported when handler is drunk-transition',
    })
  }
})

export type ActionFrontmatter = z.infer<typeof actionFrontmatterSchema>

export const roomFrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  exitN: z.string().nullable(),
  exitS: z.string().nullable(),
  exitE: z.string().nullable(),
  exitW: z.string().nullable(),
  exitU: z.string().nullable(),
  exitD: z.string().nullable(),
  exitNRequires: z.string().optional(),
  exitNLockedText: z.string().optional(),
  exitSRequires: z.string().optional(),
  exitSLockedText: z.string().optional(),
  exitERequires: z.string().optional(),
  exitELockedText: z.string().optional(),
  exitWRequires: z.string().optional(),
  exitWLockedText: z.string().optional(),
  exitURequires: z.string().optional(),
  exitULockedText: z.string().optional(),
  exitDRequires: z.string().optional(),
  exitDLockedText: z.string().optional(),
  items: z.array(z.string()).default([]),
  encounter: z.string().nullable().optional(),
  safe: z.boolean().optional(),
})

export type RoomFrontmatter = z.infer<typeof roomFrontmatterSchema>

export const itemFrontmatterSchema = z.object({
  id: z.string().min(1),
  names: z.array(z.string().min(1)).min(1),
  short: z.string().min(1),
  takeable: z.boolean(),
  initialState: stateRecordSchema.default({}),
  readable: z.boolean().optional(),
  lightable: z.boolean().optional(),
  lighter: z.boolean().optional(),
  lighterUses: z.number().int().nonnegative().optional(),
})

export type ItemFrontmatter = z.infer<typeof itemFrontmatterSchema>

export const endingFrontmatterSchema = z.object({
  id: z.string().min(1),
  whenFlags: stateRecordSchema.default({}),
})

export type EndingFrontmatter = z.infer<typeof endingFrontmatterSchema>

export const encounterFrontmatterSchema = z.object({
  id: z.string().min(1),
  startsIn: z.string().min(1),
  initialPhase: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  onResolved: z.object({
    setFlags: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
    unlockExits: z.array(z.object({
      room: z.string().min(1),
      direction: directionSchema,
    })).optional(),
  }).optional(),
  onFailed: z.object({
    narration: z.string().min(1),
    retreatTo: z.string().min(1),
  }).optional(),
  defaultWrongVerbNarration: z.string().min(1).optional(),
  phases: z.record(z.string().min(1), z.object({
    description: z.string().min(1),
    transitions: z.array(z.object({
      verb: verbSchema,
      target: z.string().min(1).optional(),
      chipLabel: z.string().min(1).optional(),
      chipCommand: z.string().min(1).optional(),
      requires: z.object({
        item: z.string().min(1),
        state: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
      }).optional(),
      to: z.string().min(1),
      narration: z.string().min(1),
      resolveCost: resolveCostSchema.optional(),
      setFlags: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
    })).default([]),
  })).optional(),
})

export type EncounterFrontmatter = z.infer<typeof encounterFrontmatterSchema>
