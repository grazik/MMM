import type { z } from "zod";
import type { CONFIG_SCHEMA } from "@/config/config";

export type Config = z.infer<typeof CONFIG_SCHEMA>;
