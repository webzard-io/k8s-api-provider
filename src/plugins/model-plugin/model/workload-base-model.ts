import type {
  DaemonSet,
  Deployment,
  StatefulSet,
} from 'kubernetes-types/apps/v1';
import type { CronJob, Job } from 'kubernetes-types/batch/v1';
import { Pod } from 'kubernetes-types/core/v1';
import { shortenedImage } from '../../../utils/string';
import { ResourceModel } from './resource-model';
import { GlobalStore } from '../../../global-store';

type WorkloadBaseTypes = Required<
  Deployment | StatefulSet | Job | DaemonSet | CronJob | Pod
>;

export class WorkloadBaseModel<
  T extends WorkloadBaseTypes
> extends ResourceModel<T> {
  public spec?: T['spec'];
  public status?: T['status'];

  constructor(public rawYaml: T, public globalStore: GlobalStore) {
    super(rawYaml, globalStore);
  }

  get imageNames() {
    const containers =
      // cronjob
      this.rawYaml.spec && 'jobTemplate' in this.rawYaml.spec
        ? this.rawYaml.spec.jobTemplate.spec?.template.spec?.containers
        : // other wokload
        this.rawYaml.spec && 'template' in this.rawYaml.spec
        ? this.rawYaml.spec?.template.spec?.containers
        : [];

    return (
      containers?.map(container => shortenedImage(container.image || '')) || []
    );
  }
}
