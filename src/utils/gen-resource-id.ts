import { Unstructured } from '../kube-api';

export function genResourceId(obj: Unstructured) {
  if (!obj.metadata?.namespace) {
    return obj.metadata?.name || '';
  }
  return `${obj.metadata?.namespace}/${obj.metadata?.name}`;
}
