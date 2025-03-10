import { CrudSorting } from '@refinedev/core';
import { get, isNil } from 'lodash-es';
import { Unstructured } from '../kube-api';

export function sortData(
  sorting: CrudSorting,
  data: Unstructured[]
): Unstructured[] {
  if (!sorting?.length) return data;

  return [...data].sort((a, b) => {
    for (const sort of sorting) {
      const { field, order } = sort;
      const aValue = get(a, field);
      const bValue = get(b, field);
      if (isNil(aValue) && isNil(bValue)) {
        continue;
      }
      if (isNil(aValue)) {
        return order === 'asc' ? 1 : -1;
      }
      if (isNil(bValue)) {
        return order === 'asc' ? -1 : 1;
      }
      if (aValue < bValue) {
        return order === 'asc' ? -1 : 1;
      } else if (aValue > bValue) {
        return order === 'asc' ? 1 : -1;
      }
    }
    return 0;
  });
}
