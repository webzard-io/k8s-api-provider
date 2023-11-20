import { paginateData } from '../../src/utils/paginate-data';
import { Pagination } from '@refinedev/core';

describe('paginateData function', () => {
  const unstructuredData = [
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
    {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod C' },
    },
    {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod C' },
    },
    {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod C' },
    },
    {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod C' },
    },
  ];

  it('should paginate data in client mode with default settings', () => {
    const pagination = {};
    console.warn = jest.fn(); // mock error
    const paginatedData = paginateData(pagination, unstructuredData);
    const expectedPaginatedData = unstructuredData;
    expect(paginatedData).toEqual(expectedPaginatedData);
    expect(console.warn).toHaveBeenCalledWith(
      'Skip simulated paging.'
    );
  });

  it('should no paginate data with custom settings', () => {
    const pagination = { current: 2, pageSize: 2, mode: 'off' };
    console.warn = jest.fn(); // mock error
    const paginatedData = paginateData(pagination, unstructuredData);
    const expectedPaginatedData = unstructuredData
    expect(paginatedData).toEqual(expectedPaginatedData);
    expect(console.warn).toHaveBeenCalledWith(
      'Skip simulated paging.'
    );
  });

  it('should paginate data if server mode is specified', () => {
    const pagination = { mode: 'server',  current: 2, pageSize: 2, };
    console.warn = jest.fn(); // mock error
    const paginatedData = paginateData(
      pagination as Pagination,
      unstructuredData
    );
    const expectedPaginatedData = unstructuredData.slice(2, 4);
    expect(paginatedData).toEqual(expectedPaginatedData);
  });

  it('should do nothing if client mode is specified', () => {
    const pagination = { mode: 'client' };
    console.warn = jest.fn(); // mock error
    const paginatedData = paginateData(
      pagination as Pagination,
      unstructuredData
    );
    const expectedPaginatedData = unstructuredData;
    expect(paginatedData).toEqual(expectedPaginatedData);
  });
});
