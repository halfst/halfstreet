import { z } from 'zod'

const stateValueSchema = z.union([z.string(), z.boolean(), z.number(), z.array(z.string())])
const stateRecordSchema = z.record(z.string(), stateValueSchema)

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
  id: z.enum(['true', 'wrong', 'bad']),
  whenFlags: stateRecordSchema.default({}),
})

export type EndingFrontmatter = z.infer<typeof endingFrontmatterSchema>

export const encounterFrontmatterSchema = z.object({
  id: z.string().min(1),
  startsIn: z.string().min(1),
  initialPhase: z.string().min(1),
})

export type EncounterFrontmatter = z.infer<typeof encounterFrontmatterSchema>
