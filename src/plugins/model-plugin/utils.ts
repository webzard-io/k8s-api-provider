import { LabelSelector } from 'kubernetes-types/meta/v1';
import { PodModel } from './model/pod-model';

export function matchSelector(pod: PodModel, selector: LabelSelector): boolean {
  let match = true;
  // TODO: support complete selector match strategy
  // https://github.com/rancher/dashboard/blob/master/shell/utils/selector.js#L166
  for (const key in selector.matchLabels) {
    if (
      !pod.metadata?.labels?.[key] ||
      pod.metadata.labels?.[key] !== selector.matchLabels[key]
    ) {
      match = false;
    }
  }
  return match;
}
