import { CronJob } from 'kubernetes-types/batch/v1';
import { set, cloneDeep } from 'lodash';
import { WorkloadBaseModel } from './workload-base-model';
import { GlobalStore } from '../../../global-store';

type RequiredCronJob = Required<CronJob>;

export class CronJobModel extends WorkloadBaseModel<RequiredCronJob> {
  constructor(
    public _rawYaml: RequiredCronJob,
    public _globalStore: GlobalStore
  ) {
    super(_rawYaml, _globalStore);
  }

  suspend() {
    const newOne = cloneDeep(this._rawYaml);
    if (this._rawYaml.kind === 'CronJob') {
      set(newOne, 'spec.suspend', true);
    }
    return newOne;
  }

  resume() {
    const newOne = cloneDeep(this._rawYaml);
    if (this._rawYaml.kind === 'CronJob') {
      set(newOne, 'spec.suspend', false);
    }
    return newOne;
  }
}
