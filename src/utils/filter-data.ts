import { CrudFilters, CrudOperators, LogicalFilter } from '@refinedev/core';
import _ from 'lodash';
import { Unstructured } from '../kube-api';

export const filterData = (
  filters: CrudFilters,
  data: Unstructured[]
): Unstructured[] => {
  if (!filters || filters.length === 0) {
    return data;
  }

  return data.filter(item => {
    return filters.every(filter => {
      if ('field' in filter) {
        // Logical filter
        const { field, operator, value } = filter;
        return evaluateFilter(item, field, operator, value);
      } else {
        // Conditional filter
        const { operator, value } = filter;
        if (operator === 'or') {
          return value.some(subFilter => {
            const { field, operator, value } = subFilter as LogicalFilter;
            return evaluateFilter(item, field, operator, value);
          });
        } else if (operator === 'and') {
          return value.every(subFilter => {
            const { field, operator, value } = subFilter as LogicalFilter;
            return evaluateFilter(item, field, operator, value);
          });
        }
      }
      return true;
    });
  });
};

export function evaluateFilter(
  item: Unstructured,
  field: string,
  operator: Exclude<CrudOperators, 'or' | 'and'>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
): boolean {
  const fieldValue = _.get(item, field);

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
          return _.includes(fieldValue, item);
        }
        return item === fieldValue
      });
    }
    case 'nin': {
      if (!Array.isArray(value)) {
        return false;
      }
      return value.every(item => {
        if (Array.isArray(fieldValue)) {
          return !_.includes(fieldValue, item);
        }
        return item !== fieldValue
      });
    }
    case 'contains':
      return _.includes(fieldValue, value);
    case 'ncontains':
      return !_.includes(fieldValue, value);
    case 'containss':
      return _.includes(fieldValue.toLowerCase(), value.toLowerCase());
    case 'ncontainss':
      return !_.includes(fieldValue.toLowerCase(), value.toLowerCase());
    case 'between':
      return value[0] <= fieldValue && fieldValue <= value[1];
    case 'nbetween':
      return value[0] > fieldValue || fieldValue > value[1];
    case 'null':
      return fieldValue === null;
    case 'nnull':
      return fieldValue !== null;
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
      return !fieldValue.toLowerCase().endsWith(value.toLowerCase());
  }
}
