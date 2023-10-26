import { Pagination } from '@refinedev/core';
import { Unstructured } from '../kube-api';

export const paginateData = (
  pagination: Pagination,
  data: Unstructured[]
): Unstructured[] => {
  const { current = 1, pageSize = 20, mode } = pagination ?? {};
  if (mode !== 'client') {
    console.warn('k8s no support server paginateData');
    return data;
  }
  let start = 0;
  let end = data.length;
  const pageRowLastIndex = current * pageSize;
  start = (current - 1) * pageSize;
  end = pageRowLastIndex < end ? pageRowLastIndex : end;
  return data.slice(start, end);
};
