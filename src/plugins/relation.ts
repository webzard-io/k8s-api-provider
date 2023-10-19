import { LabelSelector, ObjectMeta } from 'kubernetes-types/meta/v1';
import {
  DaemonSet,
  Deployment,
  ReplicaSet,
  StatefulSet,
} from 'kubernetes-types/apps/v1';
import { Job } from 'kubernetes-types/batch/v1';
import { Unstructured, UnstructuredList } from '../kube-api';
import { Service } from 'kubernetes-types/core/v1';
import { omit } from 'lodash';

export type Relation = {
  kind: string;
  apiVersion: string;
  type: 'creates' | 'uses' | 'applies' | 'owner' | 'selects';
  inbound: boolean;
  // TODO: use union types
  name?: string;
  namespace?: string;
  selector?: LabelSelector;
};

export type ExtendObjectMeta = ObjectMeta & {
  relations?: Relation[];
};

class RelationPlugin {
  processData(res: UnstructuredList): UnstructuredList {
    const { kind, apiVersion } = res;
    res.items = res.items.map(item =>
      this.processItem({
        ...item,
        // TODO: unify this with data-provider getOne method
        kind: kind.replace(/List$/g, ''),
        apiVersion,
      })
    );
    return res;
  }

  processItem(item: Unstructured): Unstructured {
    this.processPodSelector(item);
    return item;
  }

  restoreData(res: UnstructuredList): UnstructuredList {
    res.items = res.items.map(item => this.restoreItem(item));
    return res;
  }

  restoreItem(item: Unstructured): Unstructured {
    return {
      ...item,
      metadata: omit(item.metadata, 'relations'),
    };
  }

  processPodSelector(item: Unstructured): Unstructured {
    const { spec, kind } = item as
      | Deployment
      | DaemonSet
      | StatefulSet
      | ReplicaSet
      | Job
      | Service;

    const selector = spec?.selector;
    if (!selector) {
      return item;
    }

    // TODO: also check apiVersion along with kind
    if (
      !kind ||
      ![
        'Deployment',
        'DaemonSet',
        'StatefulSet',
        'ReplicaSet',
        'Job',
        'Service',
      ].includes(kind)
    ) {
      return item;
    }

    // empty selector or legacy resources like Service
    if (!selector.matchLabels && !selector.matchExpressions) {
      selector.matchLabels = {};
      for (const key of Object.keys(selector)) {
        if (key === 'matchLabels') {
          continue;
        }
        selector.matchLabels[key] = (selector as Record<string, string>)[key];
        delete (selector as Record<string, string>)[key];
      }
    }

    this.appendRelation(item, {
      kind: 'Pod',
      apiVersion: 'v1',
      type: kind === 'Service' ? 'selects' : 'creates',
      selector,
      inbound: false,
    });

    return item;
  }

  appendRelation(item: Unstructured, relation: Relation): Unstructured {
    const metadata = item.metadata as ExtendObjectMeta;
    if (!metadata.relations) {
      metadata.relations = [];
    }

    metadata.relations.push(relation);

    return item;
  }
}

export const relationPlugin = new RelationPlugin();
