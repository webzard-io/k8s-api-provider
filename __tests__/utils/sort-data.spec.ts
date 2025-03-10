import { sortData } from '../../src/utils/sort-data';
import { CrudSorting } from '@refinedev/core';

describe('sortData function', () => {
  const unstructuredData = [
    {
      id: '1',
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod A' },
    },
    {
      id: '2',
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod B' },
    },
    {
      id: '3',
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod C' },
    },
  ];
  it('should return origin data when sorting is empty array', () => {
    const sorting: CrudSorting = [];
    const sortedData = sortData(sorting as CrudSorting, unstructuredData);
    const expectedSortedData = [
      {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod A' },
      },
      {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod B' },
      },
      {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod C' },
      },
    ];
    expect(sortedData).toEqual(unstructuredData);
  });
  it('should sort data in ascending order based on a specified field', () => {
    const sorting = [{ field: 'metadata.name', order: 'asc' }];
    const sortedData = sortData(sorting as CrudSorting, unstructuredData);
    const expectedSortedData = [
      {
        id: '1',
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod A' },
      },
      {
        id: '2',
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod B' },
      },
      {
        id: '3',
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod C' },
      },
    ];
    expect(sortedData).toEqual(expectedSortedData);
  });

  it('should sort data in descending order based on a specified field', () => {
    const sorting = [{ field: 'metadata.name', order: 'desc' }];
    const sortedData = sortData(sorting as CrudSorting, unstructuredData);
    const expectedSortedData = [
      {
        id: '3',
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod C' },
      },
      {
        id: '2',
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod B' },
      },
      {
        id: '1',
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod A' },
      },
    ];
    expect(sortedData).toEqual(expectedSortedData);
  });

  it('should handle multiple sorting criteria', () => {
    const sorting = [
      { field: 'apiVersion', order: 'asc' },
      { field: 'metadata.name', order: 'desc' },
    ];
    const sortedData = sortData(sorting as CrudSorting, unstructuredData);
    const expectedSortedData = [
      {
        id: '3',
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod C' },
      },
      {
        id: '2',
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod B' },
      },
      {
        id: '1',
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod A' },
      },
    ];
    expect(sortedData).toEqual(expectedSortedData);
  });
  it('should handle nil value', () => {
    const sorting = [{ field: 'apiVersion1', order: 'asc' }];
    const sortedData = sortData(sorting as CrudSorting, unstructuredData);
    const expectedSortedData = [
      {
        id: '1',
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod A' },
      },
      {
        id: '2',
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod B' },
      },
      {
        id: '3',
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod C' },
      },
    ];
    expect(sortedData).toEqual(expectedSortedData);
  });
});
