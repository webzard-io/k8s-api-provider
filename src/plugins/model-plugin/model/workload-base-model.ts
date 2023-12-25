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
import { Unstructured } from '../../../kube-api';

type WorkloadBaseTypes = Required<
  Deployment | StatefulSet | Job | DaemonSet | CronJob | Pod
> &
  Unstructured;

export class WorkloadBaseModel<
  T extends WorkloadBaseTypes = WorkloadBaseTypes
> extends ResourceModel<T> {
  public spec?: T['spec'];
  public status?: T['status'];

  constructor(public _rawYaml: T, public _globalStore: GlobalStore) {
    super(_rawYaml, _globalStore);
  }

  get imageNames() {
    const containers =
      // cronjob
      this._rawYaml.spec && 'jobTemplate' in this._rawYaml.spec
        ? this._rawYaml.spec.jobTemplate.spec?.template.spec?.containers
        : // other wokload
        this._rawYaml.spec && 'template' in this._rawYaml.spec
        ? this._rawYaml.spec?.template.spec?.containers
        : [];

    return (
      containers?.map(container => shortenedImage(container.image || '')) || []
    );
  }
}
