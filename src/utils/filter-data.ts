import { CrudFilter, CrudFilters, CrudOperators } from '@refinedev/core';
import { get, has, isNil, includes } from 'lodash-es';
import { Unstructured } from '../kube-api';

type Filter = CrudFilter & {
  fn?: (item: Unstructured) => boolean;
}

function deepFilter(item: Unstructured, filter: Filter): boolean {
  if (filter.fn) {
    return filter.fn(item);
  } else if ('field' in filter) {
    // Logical filter
    const { field, operator, value } = filter;
    return evaluateFilter(item, field, operator, value);
  } else {
    // Conditional filter
    const { operator, value } = filter;
    if (operator === 'or') {
      return value.some(subFilter => deepFilter(item, subFilter));
    } else if (operator === 'and') {
      return value.every(subFilter => deepFilter(item, subFilter));
    }
  }
  return true;
}

export const filterData = (
  filters: CrudFilters,
  data: Unstructured[]
): Unstructured[] => {
  if (!filters || filters.length === 0) {
    return data;
  }

  return data.filter(item => filters.every(filter => deepFilter(item, filter)));
};

export function evaluateFilter(
  item: Unstructured,
  field: string,
  operator: Exclude<CrudOperators, 'or' | 'and'>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
): boolean {
  if (!has(item, field)) {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fieldValue:any = get(item, field);

  switch (operator) {
    case 'eq':
      return fieldValue === value;
    case 'ne':
      return fieldValue !== value;
    case 'lt':
      return fieldValue < value;
    case 'gt':
      return fieldValue > value;
    case 'lte':
      return fieldValue <= value;
    case 'gte':
      return fieldValue >= value;
    case 'in': {
      if (!Array.isArray(value)) {
        return false;
      }
      return value.some(item => {
        if (Array.isArray(fieldValue)) {
          return includes(fieldValue, item);
        }
        return item === fieldValue;
      });
    }
    case 'nin': {
      if (!Array.isArray(value)) {
        return false;
      }
      return value.every(item => {
        if (Array.isArray(fieldValue)) {
          return !includes(fieldValue, item);
        }
        return item !== fieldValue;
      });
    }
    case 'contains':
      return includes(fieldValue, value);
    case 'ncontains':
      return !includes(fieldValue, value);
    case 'containss':
      return includes(fieldValue.toLowerCase(), value.toLowerCase());
    case 'ncontainss':
      return !includes(fieldValue.toLowerCase(), value.toLowerCase());
    case 'between':
      return value[0] <= fieldValue && fieldValue <= value[1];
    case 'nbetween':
      return value[0] > fieldValue || fieldValue > value[1];
    case 'null': {
      return isNil(fieldValue);
    }
    case 'nnull': {
      return !isNil(fieldValue);
    }
    case 'startswith':
      return fieldValue.startsWith(value);
    case 'nstartswith':
      return !fieldValue.startsWith(value);
    case 'startswiths':
      return fieldValue.toLowerCase().startsWith(value.toLowerCase());
    case 'nstartswiths':
      return !fieldValue.toLowerCase().startsWith(value.toLowerCase());
    case 'endswith':
      return fieldValue.endsWith(value);
    case 'nendswith':
      return !fieldValue.endsWith(value);
    case 'endswiths':
      return fieldValue.toLowerCase().endsWith(value.toLowerCase());
    case 'nendswiths':
      return !(fieldValue).toLowerCase().endsWith((value).toLowerCase());
  }
}
