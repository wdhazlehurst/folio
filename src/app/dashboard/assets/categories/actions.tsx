"use server";

import type { NewAssetCategory, AssetCategory } from "@/types/asset";
import { ActionResult } from "@/types/api";
import { dbClient } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

export async function updateAssetCategory(data: AssetCategory): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) redirect("/auth/login");

  try {
    const existing = await dbClient.assetCategory.findFirst({
      where: { id: data.id, userId },
    });

    if (!existing) return { ok: false, error: "Category not found" };

    await dbClient.assetCategory.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description ?? null,
      },
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { ok: false, error: `Category '${data.title}' already exists` };
      }
    }
    console.error("Error updating asset category:", error);
    return { ok: false, error: "Error updating category" };
  }
}

export async function getCategoryById(userId: string, id: string): Promise<string | null> {
  const category = await dbClient.assetCategory.findFirst({
    where: { id, userId },
  });
  return category ? category.id : null;
}

export async function getCategoryByTitle(userId: string, title: string): Promise<string | null> {
  const category = await dbClient.assetCategory.findFirst({
    where: {
      title: { equals: title, mode: "insensitive" },
      userId,
    },
  });
  return category ? category.id : null;
}

export async function addAssetCategory(data: NewAssetCategory): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) redirect("/auth/login");

  const existing = await getCategoryByTitle(userId, data.title);
  if (existing) return { ok: false, error: "Category already exists" };

  try {
    await dbClient.assetCategory.create({
      data: {
        title: data.title,
        description: data.description,
        userId,
      },
    });
    return { ok: true };
  } catch (error) {
    console.error("Error creating asset category:", error);
    return { ok: false, error: "Error adding category" };
  }
}

export async function getUserAssetCategories(): Promise<AssetCategory[]> {
  const userId = await getUserId();
  if (!userId) redirect("/auth/login");

  return dbClient.assetCategory.findMany({
    where: { userId },
    select: { id: true, title: true, description: true },
  });
}
