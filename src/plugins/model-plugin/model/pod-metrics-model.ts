import { PodMetrics, ResourceQuantity } from '../types/metric';
import { formatSi, parseSi } from '../../..//utils/unit';
import { ResourceModel } from './resource-model';
import { GlobalStore } from '../../../global-store';

export class PodMetricsModel extends ResourceModel<PodMetrics> {
  public usage: ResourceQuantity;

  constructor(public data: PodMetrics, public globalStore: GlobalStore) {
    super(data, globalStore);

    let cpuUsageNum = 0;
    let memoryUsageNum = 0;
    for (const container of data.containers) {
      cpuUsageNum += parseSi(container.usage.cpu || '0');
      memoryUsageNum += parseSi(container.usage.memory || '0');
    }

    this.usage = {
      cpu: {
        value: cpuUsageNum,
        si: formatSi(1000 * cpuUsageNum, {
          suffix: 'm',
          maxPrecision: 0,
        }),
      },
      memory: {
        value: memoryUsageNum,
        si: formatSi(memoryUsageNum, {
          suffix: 'i',
          maxPrecision: 0,
        }),
      },
    };
  }
}
