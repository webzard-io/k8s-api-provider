import { Unstructured, UnstructuredList } from '../../kube-api';
import {
  CronJobModel,
  JobModel,
  PodModel,
  ResourceModel,
  WorkloadModel,
} from '../model-plugin/model';
import { GlobalStore } from '../../global-store';
import { DataList, IProviderPlugin } from '../type';

const ModelMap = {
  Deployment: WorkloadModel,
  DaemonSet: WorkloadModel,
  StatefulSet: WorkloadModel,
  CronJob: CronJobModel,
  Job: JobModel,
  Pod: PodModel,
};

class ModelPlugin implements IProviderPlugin<ResourceModel> {
  _globalStore?: GlobalStore;

  init(globalStore: GlobalStore) {
    this._globalStore = globalStore;
  }

  async processData(res: UnstructuredList) {
    const { kind, apiVersion } = res;
    const items = await Promise.all(
      res.items.map(item =>
        this.processItem({
          ...item,
          // TODO: unify this with data-provider getOne method
          kind: kind.replace(/List$/g, ''),
          apiVersion,
        })
      )
    );
    return {
      ...res,
      items,
    } as DataList<ResourceModel>;
  }

  async processItem(item: Unstructured): Promise<ResourceModel> {
    const Model = ModelMap[item.kind as keyof typeof ModelMap] || ResourceModel;
    const result = new Model(item as never, this._globalStore!);
    await result.init();
    return result as ResourceModel;
  }

  restoreData(res: DataList<ResourceModel>): UnstructuredList {
    const newRes: UnstructuredList = { ...res };
    newRes.items = res.items.map(item => this.restoreItem(item));
    return res;
  }

  restoreItem(item: ResourceModel): Unstructured {
    return item.rawYaml;
  }
}

export const modelPlugin = new ModelPlugin();
