import type { BasePlugin } from './index.d';
import { Unstructured, UnstructuredList } from '../kube-api';
import { relationPlugin } from './relation';
import { idPlugin } from './id';

class Formatter implements BasePlugin {
  constructor(private plugins: BasePlugin[]) {

  }

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

  processItem(item: Unstructured) {
    return this.plugins.reduce((result, plugin)=> {
      return plugin.processItem(result);
    }, item);
  }

  restoreData(res: UnstructuredList): UnstructuredList {
    res.items = res.items.map(item => this.restoreItem(item));
    
    return res;
  }

  restoreItem(item: Unstructured): Unstructured {
    return this.plugins.reduce((result, plugin)=> {
      return plugin.restoreItem(result);
    }, item);
  }
}

export const formatterPlugin = new Formatter([idPlugin, relationPlugin]);
