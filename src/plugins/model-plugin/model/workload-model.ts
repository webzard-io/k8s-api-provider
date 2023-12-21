import type {
  DaemonSet,
  Deployment,
  StatefulSet,
} from 'kubernetes-types/apps/v1';
import { WorkloadBaseModel } from './workload-base-model';
import { cloneDeep, get, set, sumBy } from 'lodash';
import { GlobalStore } from '../../../global-store';
import { PodModel } from './pod-model';
import { matchSelector } from '../utils';

type WorkloadTypes = Required<Deployment | StatefulSet | DaemonSet>;

export const TIMESTAMP_LABEL = 'sks.user.kubesmart.smtx.io/timestamp';

export class WorkloadModel extends WorkloadBaseModel<WorkloadTypes> {
  public restarts = 0;
  constructor(public _rawYaml: WorkloadTypes, public _globalStore: GlobalStore) {
    super(_rawYaml, _globalStore);
  }

  override async init() {
    await this.getRestarts();
  }

  private async getRestarts() {
    const pods = await this._globalStore.get('pods', {
      resourceBasePath: '/api/v1',
      kind: 'Pod',
    });
    const myPods = pods.items.filter(p =>
      this.spec?.selector
        ? matchSelector(p as PodModel, this.spec?.selector)
        : false
    );
    const result = sumBy(myPods, 'restartCount');
    this.restarts = result;
  }

  redeploy(): WorkloadTypes {
    const newOne = cloneDeep(this._rawYaml);
    const path = 'spec.template.metadata.annotations';
    const annotations = get(newOne, path, {});
    set(newOne, path, {
      ...annotations,
      [TIMESTAMP_LABEL]: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    });
    return newOne;
  }

  scale(value: number): WorkloadTypes {
    const newOne = cloneDeep(this._rawYaml);
    if (newOne.kind === 'Deployment' || newOne.kind === 'StatefulSet') {
      set(newOne, 'spec.replicas', value);
    }
    return newOne;
  }
}
