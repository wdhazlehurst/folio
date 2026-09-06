"use server";

import { type Asset, type NewAsset } from "@/types/asset";
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ActionResult } from "@/types/api";
import { QuerySerializer } from "@/lib/query-builder";
import { ASSET_QUERY_FIELDS, type AssetQueryField } from "@/lib/query-fields";
import { getCategoryById } from "./categories/actions";

export async function addAsset(data: NewAsset): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) redirect("/auth/login");

  const d = new Date(data.date);
  if (isNaN(d.getTime())) return { ok: false, error: "Invalid date" };

  if (data.categoryId) {
    const categoryId = await getCategoryById(userId, data.categoryId);
    if (!categoryId) return { ok: false, error: "Selected category doesn't exist" };
  }

  try {
    const newAsset = await dbClient.asset.create({
      data: {
        title: data.title,
        amount: data.amount,
        isCash: data.isCash,
        userId,
        categoryId: data.categoryId ?? null,
        date: d.toISOString(),
      },
    });
    if (!newAsset) return { ok: false, error: "Could not add asset" };
  } catch (error) {
    console.error("Error adding asset:", error);
    return { ok: false, error: "Could not add asset, try again" };
  }

  return { ok: true };
}

export async function updateAsset(data: Asset): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) redirect("/auth/login");

  try {
    const updated = await dbClient.asset.update({
      where: { id: data.id, userId },
      data: {
        title: data.title,
        amount: data.amount,
        isCash: data.isCash,
        categoryId: data.categoryId ?? null,
        date: data.date,
      },
    });
    if (!updated) return { ok: false, error: "Could not update asset" };
    return { ok: true };
  } catch (error) {
    console.error("Error updating asset:", error);
    return { ok: false, error: "Error updating asset" };
  }
}

export async function getUserAssets(): Promise<Asset[]> {
  const userId = await getUserId();
  if (!userId) redirect("/auth/login");

  const assets = await dbClient.asset.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      amount: true,
      isCash: true,
      categoryId: true,
      category: { select: { title: true, id: true } },
      date: true,
      userId: true,
    },
    orderBy: { date: "desc" },
  });

  return assets.map((a) => ({
    id: a.id,
    title: a.title,
    amount: a.amount.toNumber(),
    isCash: a.isCash,
    category: a.category?.title ?? "Uncategorized",
    categoryId: a.category?.id ?? null,
    date: a.date,
    userId: a.userId,
  }));
}

export async function assetApi(query: unknown) {
  const userId = await getUserId();
  if (!userId) redirect("/auth/login");

  try {
    // Throws if the query names a field outside ASSET_QUERY_FIELDS.
    const serializer = new QuerySerializer<Asset, AssetQueryField>(userId, query, ASSET_QUERY_FIELDS);

    const results = await dbClient.asset.findMany({
      ...serializer.transform(),
      select: {
        id: true,
        title: true,
        amount: true,
        isCash: true,
        date: true,
        category: { select: { title: true, id: true } },
      },
    });

    return results.map((a) => ({
      ...a,
      amount: a.amount.toNumber(),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Query failed";
    console.error("Asset query error:", message);
    return { error: message };
  }
}
