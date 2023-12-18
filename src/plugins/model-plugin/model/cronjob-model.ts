import { CronJob } from 'kubernetes-types/batch/v1';
import { set, cloneDeep } from 'lodash';
import { WorkloadBaseModel } from './workload-base-model';
import { GlobalStore } from '../../../global-store';

type RequiredCronJob = Required<CronJob>;

export class CronJobModel extends WorkloadBaseModel<RequiredCronJob> {
  constructor(
    public rawYaml: RequiredCronJob,
    public globalStore: GlobalStore
  ) {
    super(rawYaml, globalStore);
  }

  suspend() {
    const newOne = cloneDeep(this.rawYaml);
    if (this.rawYaml.kind === 'CronJob') {
      set(newOne, 'spec.suspend', true);
    }
    return newOne;
  }

  resume() {
    const newOne = cloneDeep(this.rawYaml);
    if (this.rawYaml.kind === 'CronJob') {
      set(newOne, 'spec.suspend', false);
    }
    return newOne;
  }
}
