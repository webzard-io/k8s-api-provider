import { filterData, evaluateFilter } from '../../src/utils/filter-data';
import { CrudFilters } from '@refinedev/core';
import { Unstructured } from '../../lib';

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
    const filters: CrudFilters = [];
    const filteredData = filterData(filters, unstructuredData);
    expect(filteredData).toEqual(unstructuredData);
  });

  it('filters with nested structure', () => {
    const filters: CrudFilters = [
      {
        field: 'status.state', operator: 'eq', value: 'Normal',
      },
      {
        field: 'status.state', operator: 'in', value: [
          'InUpdate',
          'InRollback',
        ],
      },
      {
        operator: 'and', value: [
          {
            field: 'metadata.deletionTimestamp', operator: 'nnull', value: true,
          },
          {
            field: 'status.state', operator: 'ne', value: 'DeleteFailed',
          },
        ],
      },
    ];
    const data: (Unstructured & { status: { state: string; } })[] = [
      {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod A', namespace: 'Namespace A' },
        status: {
          state: 'Normal',
        },
      },
      {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod B', namespace: 'Namespace B' },
        status: {
          state: 'InRollback',
        },
      },
      {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'Pod C', namespace: 'Namespace A', deletionTimestamp: 'mock time' },
        status: {
          state: 'InUpgrade',
        },
      },
    ];

    expect(filterData([
      {
        operator: 'and',
        value: [
          filters[0],
        ],
      },
    ], data)).toEqual([{
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod A', namespace: 'Namespace A' },
      status: {
        state: 'Normal',
      },
    }]);

    expect(filterData([
      {
        operator: 'and',
        value: [
          filters[1],
        ],
      },
    ], data)).toEqual([{
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod B', namespace: 'Namespace B' },
      status: {
        state: 'InRollback',
      },
    }]);

    expect(filterData([
      {
        operator: 'and',
        value: [
          filters[2],
        ],
      },
    ], data)).toEqual([{
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod C', namespace: 'Namespace A', deletionTimestamp: 'mock time' },
      status: {
        state: 'InUpgrade',
      },
    },]);

    expect(filterData([
      {
        operator: 'and',
        value: filters,
      },
    ], data)).toEqual([]);

    expect(filterData([
      {
        operator: 'or',
        value: filters,
      },
    ], data)).toEqual(data);
  });
});

describe('evaluateFilter function', () => {
  const mockItem = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      name: 'test-pod',
      namespace: 'default',
    },
    spec: {
      total: 10,
      labels: ['label-1', 'label-2'],
      description: null,
      type: 'type-1',
    },
  } as Unstructured;

  test('handles "eq" operator', () => {
    const result = evaluateFilter(mockItem, 'kind', 'eq', 'Pod');
    expect(result).toBeTruthy();
  });

  test('handles "ne" operator', () => {
    const result = evaluateFilter(mockItem, 'kind', 'ne', 'Service');
    expect(result).toBeTruthy();
  });

  test('handles "lt" operator', () => {
    const result = evaluateFilter(mockItem, 'spec.total', 'lt', 11);
    expect(result).toBeTruthy();
  });

  test('handles "gt" operator', () => {
    const result = evaluateFilter(mockItem, 'spec.total', 'gt', 9);
    expect(result).toBeTruthy();
  });

  test('handles "lte" operator', () => {
    const result = evaluateFilter(mockItem, 'spec.total', 'lte', 10);
    expect(result).toBeTruthy();
  });

  test('handles "gte" operator', () => {
    const result = evaluateFilter(mockItem, 'spec.total', 'gte', 10);
    expect(result).toBeTruthy();
  });

  test('handles "in" operator', () => {
    expect(evaluateFilter(mockItem, 'spec.labels', 'in', ['label-1', 'label-2'])).toBeTruthy();
    expect(evaluateFilter(mockItem, 'spec.total', 'in', ['label-1', 'label-2'])).toBeFalsy();
    expect(evaluateFilter(mockItem, 'spec.total', 'in', [10, 20])).toBeTruthy();
    expect(evaluateFilter(mockItem, 'spec.type', 'in', ['type-1', 'type-2'])).toBeTruthy();
    expect(evaluateFilter(mockItem, 'spec.type', 'in', ['type-3', 'type-4'])).toBeFalsy();
    expect(evaluateFilter(mockItem, 'spec.type', 'in', 'type-1')).toBeFalsy();
  });

  test('handles "nin" operator', () => {
    expect(evaluateFilter(mockItem, 'spec.labels', 'nin', ['label-3', 'label-4'])).toBeTruthy();
    expect(evaluateFilter(mockItem, 'spec.total', 'nin', ['label-3', 'label-4'])).toBeTruthy();
    expect(evaluateFilter(mockItem, 'spec.total', 'nin', [10, 20])).toBeFalsy();
    expect(evaluateFilter(mockItem, 'spec.type', 'nin', ['type-1', 'type-2'])).toBeFalsy();
    expect(evaluateFilter(mockItem, 'spec.type', 'nin', ['type-3', 'type-4'])).toBeTruthy();
    expect(evaluateFilter(mockItem, 'spec.type', 'in', 'type-1')).toBeFalsy();
  });

  test('handles "contains" operator', () => {
    const result = evaluateFilter(mockItem, 'metadata.name', 'contains', 'test');
    expect(result).toBeTruthy();
  });

  test('handles "ncontains" operator', () => {
    const result = evaluateFilter(mockItem, 'metadata.name', 'ncontains', 'prod');
    expect(result).toBeTruthy();
  });

  test('handles "containss" operator', () => {
    const result = evaluateFilter(mockItem, 'metadata.name', 'containss', 'TEST');
    expect(result).toBeTruthy();
  });

  test('handles "ncontainss" operator', () => {
    const result = evaluateFilter(mockItem, 'metadata.name', 'ncontainss', 'PROD');
    expect(result).toBeTruthy();
  });

  test('handles "between" operator', () => {
    const result = evaluateFilter(mockItem, 'spec.total', 'between', [1, 11]);
    expect(result).toBeTruthy();
  });

  test('handles "nbetween" operator', () => {
    const result = evaluateFilter(mockItem, 'spec.total', 'nbetween', [2, 9]);
    expect(result).toBeTruthy();
  });

  test('handles "null" operator', () => {
    expect(evaluateFilter(mockItem, 'spec.description', 'null', null)).toBeTruthy();
    expect(evaluateFilter(mockItem, 'spec.non_exist_path', 'null', null)).toBeFalsy();
  });

  test('handles "nnull" operator', () => {
    expect(evaluateFilter(mockItem, 'spec.total', 'nnull', null)).toBeTruthy();
    expect(evaluateFilter(mockItem, 'spec.non_exist_path', 'null', null)).toBeFalsy();
  });

  test('handles "startswith" operator', () => {
    const result = evaluateFilter(mockItem, 'metadata.name', 'startswith', 'test');
    expect(result).toBeTruthy();
  });

  test('handles "nstartswith" operator', () => {
    const result = evaluateFilter(mockItem, 'metadata.name', 'nstartswith', 'prod');
    expect(result).toBeTruthy();
  });

  test('handles "startswiths" operator', () => {
    const result = evaluateFilter(mockItem, 'metadata.name', 'startswiths', 'TEST');
    expect(result).toBeTruthy();
  });

  test('handles "nstartswiths" operator', () => {
    const result = evaluateFilter(mockItem, 'metadata.name', 'nstartswiths', 'PROD');
    expect(result).toBeTruthy();
  });

  test('handles "endswith" operator', () => {
    const result = evaluateFilter(mockItem, 'metadata.name', 'endswith', 'pod');
    expect(result).toBeTruthy();
  });

  test('handles "nendswith" operator', () => {
    const result = evaluateFilter(mockItem, 'metadata.name', 'nendswith', 'service');
    expect(result).toBeTruthy();
  });

  test('handles "endswiths" operator', () => {
    const result = evaluateFilter(mockItem, 'metadata.name', 'endswiths', 'POD');
    expect(result).toBeTruthy();
  });

  test('handles "nendswiths" operator', () => {
    const result = evaluateFilter(mockItem, 'metadata.name', 'nendswiths', 'SERVICE');
    expect(result).toBeTruthy();
  });
});
