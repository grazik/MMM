import { z } from "zod";

// 9gag sends flags as 0/1; accept booleans too so a harmless format change doesn't fail the run.
const FLAG_SCHEMA = z.union([z.number(), z.boolean()]);

const IMAGE_VARIANT_SCHEMA = z.object({
  url: z.url(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const VIDEO_VARIANT_SCHEMA = z.object({
  url: z.url().optional(),
  vp9Url: z.url().optional(),
  vp8Url: z.url().optional(),
  width: z.number().positive(),
  height: z.number().positive(),
  hasAudio: FLAG_SCHEMA.optional(),
});

export const POST_SCHEMA = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  title: z.string(),
  type: z.string(),
  promoted: FLAG_SCHEMA.optional(),
  images: z.object({
    image700: IMAGE_VARIANT_SCHEMA.optional(),
    image460: IMAGE_VARIANT_SCHEMA.optional(),
    image460sv: VIDEO_VARIANT_SCHEMA.optional(),
  }),
});

export const HOT_PAGE_RESPONSE_SCHEMA = z.object({
  data: z.object({
    didEndOfList: FLAG_SCHEMA.optional(),
    posts: z.array(POST_SCHEMA),
  }),
});

export const GUEST_TOKEN_RESPONSE_SCHEMA = z.object({
  data: z.object({
    userToken: z.string().min(1),
  }),
});
