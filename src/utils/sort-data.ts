import { CrudSorting } from '@refinedev/core';
import _ from 'lodash';
import { Unstructured } from '../kube-api';

export function sortData(
  sorting: CrudSorting,
  data: Unstructured[]
): Unstructured[] {
  if (!sorting?.length) return data;

  return [...data].sort((a, b) => {
    for (const sort of sorting) {
      const { field, order } = sort;
      const aValue = _.get(a, field);
      const bValue = _.get(b, field);
      if (_.isNil(aValue) && _.isNil(bValue)) {
        continue;
      }
      if (_.isNil(aValue)) {
        return order === 'asc' ? 1 : -1;
      }
      if (_.isNil(bValue)) {
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
