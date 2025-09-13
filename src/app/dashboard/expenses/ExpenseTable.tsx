"use client";

import { useState, useEffect } from 'react';
import { IconChevronDown, IconChevronUp, IconSearch, IconSelector } from '@tabler/icons-react';
import {
  Center,
  Group,
  ScrollArea,
  Table,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import classes from "@/css/TableSort.module.css"
import { FrontendExpense } from '@/types/expense';
import { getUserExpenses } from './actions';


interface ThProps {
  children: React.ReactNode;
  reversed: boolean;
  sorted: boolean;
  onSort: () => void;
}

function Th({ children, reversed, sorted, onSort }: ThProps) {
  const Icon = sorted ? (reversed ? IconChevronUp : IconChevronDown) : IconSelector;
  return (
    <Table.Th className={classes.th}>
      <UnstyledButton onClick={onSort} className={classes.control}>
        <Group justify="space-between">
          <Text fw={500} fz="sm">
            {children}
          </Text>
          <Center className={classes.icon}>
            <Icon size={16} stroke={1.5} />
          </Center>
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}

function filterData(data: FrontendExpense[], search: string) {
    const query = search.toLowerCase().trim();

    if (!data.length) return [];

    return data.filter((item) =>
        Object.keys(item).some((key) => {
            const value = item[key as keyof FrontendExpense];
            return String(value).toLowerCase().includes(query);
        })
    );
}

function sortData(
  data: FrontendExpense[],
  payload: { sortBy: keyof FrontendExpense | null; reversed: boolean; search: string }
) {
  const { sortBy, reversed, search } = payload;

  // Filter first
  const filtered = filterData(data, search);

  if (!sortBy) return filtered;

  return [...filtered].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];

    let cmp = 0;

    if (typeof aValue === "number" && typeof bValue === "number") {
        cmp = aValue - bValue;
    } else {
        cmp = String(aValue).localeCompare(String(bValue));
    }

    return reversed ? -cmp : cmp;
  });
}


export default function ExpenseTable() {
  const [search, setSearch] = useState('');
  const [data, setData] = useState<FrontendExpense[]>([]);
  const [sortedData, setSortedData] = useState<FrontendExpense[]>([]);
  const [sortBy, setSortBy] = useState<keyof FrontendExpense | null>(null);
  const [reverseSortDirection, setReverseSortDirection] = useState(false);

  useEffect(() => {
    async function loadExpenses() {
        const expenses = await getUserExpenses();
        setData(expenses);
        setSortedData(expenses);
    }
    loadExpenses();
  }, []);

  const setSorting = (field: keyof FrontendExpense) => {
    const reversed = field === sortBy ? !reverseSortDirection : false;
    setReverseSortDirection(reversed);
    setSortBy(field);
    setSortedData(sortData(data, { sortBy: field, reversed, search }));
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    setSearch(value);
    setSortedData(sortData(data, { sortBy, reversed: reverseSortDirection, search: value }));
  };

  const rows = sortedData.map((row) => (
    <Table.Tr key={row.title}>
      <Table.Td>{row.title}</Table.Td>
      <Table.Td>{row.amount}</Table.Td>
      <Table.Td>{row.category}</Table.Td>
      <Table.Td>{row.date}</Table.Td>
    </Table.Tr>
  ));

  return (
    <ScrollArea>
      <TextInput
        placeholder="Search by any field"
        mb="md"
        leftSection={<IconSearch size={16} stroke={1.5} />}
        value={search}
        onChange={handleSearchChange}
      />
      <Table horizontalSpacing="md" verticalSpacing="xs" miw={700} layout="fixed">
        <Table.Tbody>
          <Table.Tr>
            <Th
              sorted={sortBy === 'title'}
              reversed={reverseSortDirection}
              onSort={() => setSorting('title')}
            >
              Title
            </Th>
            <Th
              sorted={sortBy === 'amount'}
              reversed={reverseSortDirection}
              onSort={() => setSorting('amount')}
            >
              Amount
            </Th>
            <Th
              sorted={sortBy === 'category'}
              reversed={reverseSortDirection}
              onSort={() => setSorting('category')}
            >
              Category
            </Th>
            <Th
              sorted={sortBy === 'date'}
              reversed={reverseSortDirection}
              onSort={() => setSorting('date')}
            >
              Date
            </Th>
          </Table.Tr>
        </Table.Tbody>
        <Table.Tbody>
          {rows.length > 0 ? (
            rows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={data[0] ? Object.keys(data[0]).length : 1}>
                <Text fw={500} ta="center">
                  Nothing found
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}