import { Unstructured } from '../kube-api';

export interface BasePlugin {
  processItem(item: Unstructured): Unstructured;
  restoreItem(item: Unstructured): Unstructured;
}
