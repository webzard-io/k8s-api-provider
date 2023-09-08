import { MetaQuery } from '@refinedev/core';
import { KubeApi, UnstructuredList, WatchEvent } from './kube-api';

export function getObjectConstructor(resource: string, meta?: MetaQuery) {
  return meta?.resourceBasePath
    ? {
        resourceBasePath: meta?.resourceBasePath,
        resource,
      }
    : {
        resourceBasePath: '/api/v1',
        resource: 'namespaces',
      };
}

export class GlobalStore {
  public apiUrl: string;

  private store: Map<string, UnstructuredList>;
  private subscribers: Map<string, ((data: WatchEvent) => void)[]>;

  constructor(apiUrl: string) {
    this.store = new Map();
    this.subscribers = new Map();
    this.apiUrl = apiUrl;
  }

  get<T = UnstructuredList>(resource: string, meta?: MetaQuery): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.store.has(resource)) {
        const api = new KubeApi({
          basePath: this.apiUrl,
          objectConstructor: getObjectConstructor(resource, meta),
        });

        let resolved = false;

        api
          .listWatch({
            onResponse: res => {
              if (!resolved) {
                resolve(res as unknown as T);
                resolved = true;
              }
              this.store.set(resource, res);
            },
            onEvent: event => {
              this.notify(resource, event);
            },
          })
          .catch(e => reject(e));
      } else {
        resolve(this.store.get(resource)! as unknown as T);
      }
    });
  }

  subscribe(resource: string, onEvent: (data: WatchEvent) => void) {
    if (!this.subscribers.has(resource)) {
      this.subscribers.set(resource, []);
    }

    this.subscribers.get(resource)!.push(onEvent);

    return () => {
      const handlers = this.subscribers.get(resource)!;
      this.subscribers.set(
        resource,
        handlers.filter(h => h !== onEvent)
      );
    };
  }

  private notify(resource: string, data: WatchEvent) {
    const subscribers = this.subscribers.get(resource);
    if (subscribers) {
      for (const subscriber of subscribers) {
        subscriber(data);
      }
    }
  }
}
