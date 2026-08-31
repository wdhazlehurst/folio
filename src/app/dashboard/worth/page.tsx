"use client";

import { useState, useEffect, useCallback } from "react";
import { Stack, Group, Title, Alert, Skeleton } from "@mantine/core";
import { addAsset, getUserAssets, updateAsset } from "@/app/dashboard/worth/actions";
import { getUserAssetCategories } from "./categories/actions";
import { Asset, AssetCategory } from "@/types/asset";
import AssetTable from "./AssetTable";
import AssetCategoryForm from "./categories/AssetCategoryForm";
import NewAssetForm, { type NewAssetFormValues } from "./NewAssetForm";

export default function WorthPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const refreshData = useCallback(async () => {
    try {
      const [categoriesData, assetsData] = await Promise.all([getUserAssetCategories(), getUserAssets()]);
      setCategories(categoriesData);
      setAssets(assetsData);
    } catch {
      setError("Failed to load data");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleUpdateAsset = async (updatedAsset: Asset) => {
    setError(null);
    const response = await updateAsset(updatedAsset);
    if (response && !response.ok) {
      setError(response.error ?? null);
      return;
    }
    await refreshData();
  };

  const handleAddAsset = async (assetData: NewAssetFormValues) => {
    setError(null);
    const response = await addAsset({
      ...assetData,
      date: assetData.date.toISOString(),
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
      <Group justify="space-between" align="center">
        <Title order={2}>Worth</Title>
        <NewAssetForm
          categories={categories.map((c) => ({ value: c.id, label: c.title }))}
          onSubmit={handleAddAsset}
          onUpdate={refreshData}
        />
      </Group>

      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {dataLoading ? (
        <Stack gap="xs">
          <Skeleton height={32} />
          <Skeleton height={28} />
          <Skeleton height={28} />
          <Skeleton height={28} />
        </Stack>
      ) : (
        <AssetTable assets={assets} categories={categories} onUpdateAsset={handleUpdateAsset} />
      )}

      <AssetCategoryForm categories={categories} onUpdate={refreshData} />
    </Stack>
  );
}
