"use client";

import { useState, useEffect, useCallback } from "react";
import { Stack, Text } from "@mantine/core";
import { addAsset, getUserAssets, updateAsset } from "@/app/dashboard/worth/actions";
import { getUserAssetCategories } from "./categories/actions";
import { Asset, AssetCategory } from "@/types/asset";
import AssetTable from "./AssetTable";
import AssetCategoryForm from "./categories/AssetCategoryForm";
import NewAssetForm from "./NewAssetForm";
import "@mantine/dates/styles.css";

export default function WorthPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [categoriesData, assetsData] = await Promise.all([getUserAssetCategories(), getUserAssets()]);
      setCategories(categoriesData);
      setAssets(assetsData);
    } catch {
      setError("Failed to load data");
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleUpdateAsset = async (updatedAsset: Asset) => {
    const response = await updateAsset(updatedAsset);
    if (response && !response.ok) {
      setError(response.error ?? null);
      return;
    }
    await refreshData();
  };

  const handleAddAsset = async (assetData: any) => {
    const response = await addAsset({
      ...assetData,
      date: assetData.date instanceof Date ? assetData.date.toISOString() : assetData.date,
    });
    if (response && !response.ok) {
      setError(response.error ?? null);
      return response;
    }
    await refreshData();
    return response;
  };

  return (
    <Stack>
      {error && (
        <Text color="red" size="sm" bg="red.0" p="xs">
          <strong>Error:</strong> {error}
        </Text>
      )}
      <NewAssetForm
        categories={categories.map((c) => ({ value: c.id, label: c.title }))}
        onSubmit={handleAddAsset}
        onUpdate={refreshData}
      />
      <AssetTable assets={assets} categories={categories} onUpdateAsset={handleUpdateAsset} />
      <AssetCategoryForm categories={categories} onUpdate={refreshData} />
    </Stack>
  );
}
