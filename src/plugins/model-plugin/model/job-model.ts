import { Job } from 'kubernetes-types/batch/v1';
import { elapsedTime, getSecondsDiff } from '../../../utils/time';
import { WorkloadBaseModel } from './workload-base-model';
import { GlobalStore } from '../../../global-store';

type RequiredJob = Required<Job>;

export class JobModel extends WorkloadBaseModel<RequiredJob> {
  constructor(public rawYaml: RequiredJob, public globalStore: GlobalStore) {
    super(rawYaml, globalStore);
  }

  get duration() {
    const completionTime = this.rawYaml.status?.completionTime;
    const startTime = this.rawYaml.status?.startTime;

    if (!completionTime && startTime) {
      return getSecondsDiff(startTime, Date.now().toString());
    }

    if (completionTime && startTime) {
      return getSecondsDiff(startTime, completionTime);
    }

    return 0;
  }

  get durationDisplay() {
    return elapsedTime(this.duration).label;
  }
  get completionsDisplay() {
    return `${this.rawYaml.status?.succeeded || 0}/${
      this.rawYaml.spec?.completions
    }`;
  }
}
