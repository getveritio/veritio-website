import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'

/**
 * Build-time documentation contract. Provenance fields are mandatory even on
 * overview pages so unverified SDK and hosted claims cannot silently enter the
 * public site.
 */
const docs = defineCollection({
  loader: docsLoader(),
  schema: docsSchema({
    extend: z.object({
      description: z.string().min(40).max(180),
      audience: z.array(z.enum(['newcomer', 'developer', 'operator', 'governance'])).min(1),
      kind: z.enum(['overview', 'tutorial', 'guide', 'concept', 'reference', 'troubleshooting']),
      searchIntent: z.string().min(20).max(160),
      questions: z.array(z.string().min(10).max(180)).min(1).max(5),
      lastUpdated: z.date(),
      verifiedAgainst: z.array(z.string().min(1)).min(1),
      sourceRefs: z.array(z.url()).min(1),
      claimRefs: z.array(z.string()),
    }),
  }),
})

export const collections = { docs }
