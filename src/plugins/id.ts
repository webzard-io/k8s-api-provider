import { BasePlugin } from './index.d';
import { Unstructured } from '../kube-api';
import { omit } from 'lodash';

export function getId(obj: Unstructured) {
  if (!obj.metadata?.namespace) {
    return obj.metadata?.name || '';
  }
  return `${obj.metadata?.namespace}/${obj.metadata?.name}`;
}

export type ExtendUnstructured = Unstructured & {
  id: string;
}

class IdPlugin implements BasePlugin {
  processItem(item: Unstructured) {
    (item as ExtendUnstructured).id = getId(item);

    return item;
  }

  restoreItem(item: Unstructured) {
    return omit(item, 'id');
  }
}

export const idPlugin = new IdPlugin();
