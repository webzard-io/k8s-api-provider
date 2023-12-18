import { ListMeta } from 'kubernetes-types/meta/v1';
import { Unstructured, UnstructuredList } from '../kube-api';
import { GlobalStore } from '../global-store';

export type DataList<Output extends Unstructured = Unstructured> = {
  apiVersion: string;
  kind: string;
  metadata: ListMeta;
  items: Array<Unstructured & Output>;
};

export interface IProviderPlugin<Output = Unstructured> {
  _globalStore?: GlobalStore;
  init: (globalStore: GlobalStore) => void;
  processData: (
    res: UnstructuredList
  ) => Promise<DataList<Unstructured & Output>>;
  processItem: (item: Unstructured) => Promise<Unstructured & Output>;
  restoreData: (item: DataList<Unstructured & Output>) => UnstructuredList;
  restoreItem: (item: Unstructured & Output) => Unstructured;
}
