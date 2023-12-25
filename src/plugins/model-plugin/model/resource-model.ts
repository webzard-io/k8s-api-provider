import { GlobalStore } from '../../../global-store';
import { Unstructured } from '../../../kube-api';

export type IResourceModel = Unstructured & ResourceModel;

export class ResourceModel<T extends Unstructured = Unstructured> {
  public id!: string;
  public apiVersion!: T['apiVersion'];
  public kind!: T['kind'];
  public metadata!: T['metadata'];

  constructor(public _rawYaml: T, public _globalStore: GlobalStore) {
    Object.keys(_rawYaml).forEach(key => {
      Object.defineProperty(this, key, {
        value: _rawYaml[key as keyof T],
        // should be readonly
        writable: true,
      });
    });
  }

  async init() {}

  get name() {
    return this._rawYaml.metadata?.name;
  }
  get namespace() {
    return this._rawYaml.metadata?.namespace;
  }
  get labels() {
    return this._rawYaml.metadata?.labels;
  }
  get annotations() {
    return this._rawYaml.metadata?.annotations;
  }

  restore() {
    return this._rawYaml;
  }
}
