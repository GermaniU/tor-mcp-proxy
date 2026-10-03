// Zod building blocks shared by several tool schemas.
import { z } from "zod";

export const httpUrl = z.string().url().max(2_048);
export const htmlInput = z.string().min(1).max(500_000);
