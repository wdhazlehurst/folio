import * as z from "zod";

export const AssetSchema = z.object({
  id: z.uuid().optional(),
  userId: z.uuid().optional(),
  title: z.string(),
  amount: z.number(),
  isCash: z.boolean().default(false),
  category: z.string(),
  categoryId: z.uuid().optional().nullable(),
  date: z.date(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const AssetCategorySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
});
export type AssetCategory = z.infer<typeof AssetCategorySchema>;

/**
 * Client -> Server: data required to create a new asset
 * Backend fills in userId + id automatically
 */
export interface NewAsset {
  title: string;
  amount: number;
  isCash: boolean;
  categoryId?: string | null;
  date: string;
}

export interface NewAssetCategory {
  title: string;
  description: string;
}
