import { filterData } from '../../src/utils/filter-data';
import { CrudFilters } from '@refinedev/core';

describe('filterData function', () => {
  const unstructuredData = [
    {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod A', namespace: 'Namespace A' },
    },
    {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod B', namespace: 'Namespace B' },
    },
    {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod C', namespace: 'Namespace A' },
    },
  ];

  it('should filter data based on logical filter (eq)', () => {
    const filters = [
      { field: 'metadata.namespace', operator: 'eq', value: 'Namespace A' },
    ];
    const filteredData = filterData(filters as CrudFilters, unstructuredData);
    const expectedFilteredData = [
      {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod A', namespace: 'Namespace A' },
      },
      {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod C', namespace: 'Namespace A' },
      },
    ];
    expect(filteredData).toEqual(expectedFilteredData);
  });

  it('should filter data based on conditional filter (or)', () => {
    const filters = [
      {
        operator: 'or',
        value: [
          { field: 'metadata.name', operator: 'eq', value: 'Pod A' },
          { field: 'metadata.namespace', operator: 'eq', value: 'Namespace B' },
        ],
      },
    ];
    const filteredData = filterData(filters as CrudFilters, unstructuredData);
    const expectedFilteredData = [
      {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod A', namespace: 'Namespace A' },
      },
      {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod B', namespace: 'Namespace B' },
      },
    ];
    expect(filteredData).toEqual(expectedFilteredData);
  });

  it('should filter data based on conditional filter (and)', () => {
    const filters = [
      {
        operator: 'and',
        value: [
          { field: 'metadata.namespace', operator: 'eq', value: 'Namespace A' },
          { field: 'metadata.name', operator: 'eq', value: 'Pod A' },
        ],
      },
    ];
    const filteredData = filterData(filters as CrudFilters, unstructuredData);
    const expectedFilteredData = [
      {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod A', namespace: 'Namespace A' },
      },
    ];
    expect(filteredData).toEqual(expectedFilteredData);
  });

  it('should return unfiltered data if no filters are provided', () => {
    const filters = [];
    const filteredData = filterData(filters, unstructuredData);
    expect(filteredData).toEqual(unstructuredData);
  });
});
