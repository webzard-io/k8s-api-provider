import type { Pod } from 'kubernetes-types/core/v1';
import { ResourceQuantity } from '../types/metric';
import { formatSi, parseSi } from '../../../utils/unit';
import { shortenedImage } from '../../../utils/string';
import { WorkloadBaseModel } from './workload-base-model';
import { GlobalStore } from '../../../global-store';

type RequiredPod = Required<Pod>;
export class PodModel extends WorkloadBaseModel<RequiredPod> {
  public request: ResourceQuantity;
  public limit: ResourceQuantity;

  constructor(public _rawYaml: RequiredPod, public _globalStore: GlobalStore) {
    super(_rawYaml, _globalStore);

    let cpuRequestNum = 0;
    let memoryRequestNum = 0;
    let cpuLimitNum = 0;
    let memoryLimitNum = 0;

    for (const container of _rawYaml.spec?.containers || []) {
      cpuRequestNum += parseSi(container.resources?.requests?.cpu || '0');
      memoryRequestNum += parseSi(container.resources?.requests?.memory || '0');
      cpuLimitNum += parseSi(container.resources?.limits?.cpu || '0');
      memoryLimitNum += parseSi(container.resources?.limits?.memory || '0');
    }

    this.request = {
      cpu: {
        value: cpuRequestNum,
        si: formatSi(cpuRequestNum, {
          suffix: 'm',
        }),
      },
      memory: {
        value: memoryRequestNum,
        si: formatSi(memoryRequestNum, {
          suffix: 'i',
        }),
      },
    };

    this.limit = {
      cpu: {
        value: cpuLimitNum,
        si: formatSi(cpuLimitNum, {
          suffix: 'm',
        }),
      },
      memory: {
        value: memoryLimitNum,
        si: formatSi(memoryLimitNum, {
          suffix: 'i',
        }),
      },
    };
  }

  get imageNames() {
    return (
      this._rawYaml.spec?.containers.map(container =>
        shortenedImage(container.image || '')
      ) || []
    );
  }

  get restartCount() {
    if (this._rawYaml.status?.containerStatuses) {
      return this._rawYaml.status?.containerStatuses[0].restartCount || 0;
    }
    return 0;
  }

  get readyDisplay() {
    return `${
      this._rawYaml.status?.containerStatuses?.filter(c => c.ready).length
    }/${this._rawYaml.spec?.containers.length}`;
  }
}
