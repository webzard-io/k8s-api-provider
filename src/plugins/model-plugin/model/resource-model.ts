import { GlobalStore } from '../../../global-store';
import { Unstructured } from '../../../kube-api';
import { genResourceId } from '../../../utils/gen-resource-id';

export type IResourceModel = Unstructured & ResourceModel;

export class ResourceModel<T extends Unstructured = Unstructured> {
  public id!: string;
  public apiVersion!: T['apiVersion'];
  public kind!: T['kind'];
  public metadata!: T['metadata'];

  constructor(public rawYaml: T, public globalStore: GlobalStore) {
    this.id = genResourceId(rawYaml);
    Object.keys(rawYaml).forEach(key => {
      Object.defineProperty(this, key, { value: rawYaml[key as keyof T] });
    });
  }

  async init() {}

  get name() {
    return this.rawYaml.metadata?.name;
  }
  get namespace() {
    return this.rawYaml.metadata?.namespace;
  }
  get labels() {
    return this.rawYaml.metadata?.labels;
  }
  get annotations() {
    return this.rawYaml.metadata?.annotations;
  }

  restore() {
    return this.rawYaml;
  }
}
