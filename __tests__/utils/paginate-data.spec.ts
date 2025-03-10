import { paginateData } from '../../src/utils/paginate-data';
import { Pagination } from '@refinedev/core';

describe('paginateData function', () => {
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
    {
      id: '4',
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod D' },
    },
    {
      id: '5',
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod E' },
    },
    {
      id: '6',
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod F' },
    },
    {
      id: '7',
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'Pod G' },
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
    const paginatedData = paginateData(pagination as Pagination, unstructuredData);
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
