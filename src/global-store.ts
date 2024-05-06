import { MetaQuery } from '@refinedev/core';
import {
  KubeApi,
  UnstructuredList,
  WatchEvent,
  StopWatchHandler,
  Unstructured,
} from './kube-api';
import { IProviderPlugin } from './plugin';
import { genResourceId } from './utils/gen-resource-id';

export function getObjectConstructor(resource: string, meta?: MetaQuery) {
  return meta?.resourceBasePath
    ? {
        resourceBasePath: meta?.resourceBasePath,
        resource: meta?.k8sResource || resource,
      }
    : {
        resourceBasePath: '/api/v1',
        resource: 'namespaces',
      };
}

export interface GlobalStoreInitParams {
  apiUrl: string;
  watchWsApiUrl?: string;
  prefix?: string;
  fieldManager?: string;
  kubeApiTimeout?: false | number;
  plugins?: IProviderPlugin[];
}
export interface CancelQueriesParams {
  queryKeys?: string[];
}
export class GlobalStore {
  private _apiUrl = '';
  private watchWsApiUrl?: string;
  prefix?: string;
  fieldManager?: string;

  private store = new Map<string, UnstructuredList>();
  private requestsCache: Array<{
    resource: string;
    meta?: MetaQuery;
    promise: Promise<unknown>;
  }> = [];
  private subscribers = new Map<string, ((data: WatchEvent) => void)[]>();
  private stopWatchHandlers = new Map<string, StopWatchHandler>();
  private cancelControllers = new Map<string, AbortController>();
  private _kubeApiTimeout?: false | number;

  constructor(
    params: GlobalStoreInitParams,
    public plugins: IProviderPlugin[]
  ) {
    this.init(params);
  }

  get apiUrl() {
    return this._apiUrl;
  }

  get kubeApiTimeout() {
    return this._kubeApiTimeout;
  }

  get<T = UnstructuredList>(resource: string, meta?: MetaQuery): Promise<T> {
    if (this.store.has(resource)) {
      // return cached data
      return new Promise(resolve => {
        resolve(this.store.get(resource)! as unknown as T);
      });
    }

    const cacheRequest = this.requestsCache.find(f => {
      // TODO: Its supposed to be strictly comparison of query path
      return (
        f.resource === resource &&
        f.meta?.resourceBasePath === meta?.resourceBasePath
      );
    });

    // return cached fetching request
    if (cacheRequest) {
      return cacheRequest.promise as Promise<T>;
    }

    const promise = new Promise<T>((resolve, reject) => {
      const kubeApi = new KubeApi({
        basePath: this._apiUrl,
        watchWsBasePath: this.watchWsApiUrl,
        objectConstructor: getObjectConstructor(resource, meta),
        kubeApiTimeout: this.kubeApiTimeout,
      });
      const controller = new AbortController();
      const { signal } = controller;
      this.cancelControllers.set(resource, controller);
      let resolved = false;
      kubeApi
        .listWatch({
          onResponse: async (res, event) => {
            const processedRes = await this.processList(res);
            if (!resolved) {
              resolve(processedRes as unknown as T);
              resolved = true;
            }
            this.store.set(resource, processedRes);

            if (event) {
              await this.processItem(event.object);
              this.notify(resource, event);
            }
          },
          signal,
        })
        .then(stop => {
          this.stopWatchHandlers.set(resource, stop);
        })
        .catch(e => reject(e))
        .finally(() => {
          // clear cache request
          const cacheRequestIndex = this.requestsCache.findIndex(f => {
            return f.promise === promise;
          });
          if (cacheRequestIndex > -1) {
            this.requestsCache.splice(cacheRequestIndex, 1);
          }
        });
    });

    // cache the promise
    this.requestsCache.push({
      resource,
      meta,
      promise,
    });
    return promise;
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
        handlers?.filter(h => h !== onEvent) || []
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

  publish(resource: string, data: WatchEvent) {
    this.notify(resource, data);
  }

  init(params: GlobalStoreInitParams) {
    this.destroy();
    const {
      apiUrl,
      watchWsApiUrl,
      prefix,
      fieldManager,
      kubeApiTimeout,
      plugins,
    } = params;
    this.store = new Map();
    this.subscribers = new Map();
    this.stopWatchHandlers = new Map();
    this.cancelControllers = new Map();
    this._apiUrl = apiUrl;
    this.watchWsApiUrl = watchWsApiUrl;
    this.prefix = prefix;
    this.fieldManager = fieldManager;
    this._kubeApiTimeout = kubeApiTimeout;
    this.loadPlugins(plugins);
  }
  loadPlugins(plugins?: IProviderPlugin[]) {
    if (plugins) {
      this.destroy();
      this.plugins = plugins;
      this.plugins.forEach(plugin => plugin.init(this));
    }
  }
  private async processList(list: UnstructuredList) {
    let nextList = list;
    nextList.items.forEach(item => {
      item.id = genResourceId(item);
    });
    for (const plugin of this.plugins) {
      nextList = await plugin.processData(nextList);
    }
    return nextList;
  }

  private async processItem(item: Unstructured) {
    let nextItem = item;
    nextItem.id = genResourceId(item);
    for (const plugin of this.plugins) {
      nextItem = await plugin.processItem(nextItem);
    }
    return nextItem;
  }

  restoreItem(item: Unstructured): Unstructured {
    let nextItem = item;
    // restore in reversed order
    for (const plugin of [...this.plugins].reverse()) {
      nextItem = plugin.restoreItem(nextItem);
    }
    return nextItem;
  }

  restoreData(list: UnstructuredList): UnstructuredList {
    let nextList = list;
    // restore in reversed order
    for (const plugin of [...this.plugins].reverse()) {
      nextList = plugin.restoreData(nextList);
    }
    return nextList;
  }

  destroy() {
    this.store.clear();
    this.subscribers.clear();
    for (const stopWatch of this.stopWatchHandlers.values()) {
      stopWatch?.();
    }
    this.stopWatchHandlers.clear();
    this.cancelControllers.clear();
  }

  cancelQueries(params?: CancelQueriesParams) {
    if (params?.queryKeys) {
      for (const queryKey of params.queryKeys) {
        const controller = this.cancelControllers.get(queryKey);
        if (controller) {
          controller.abort();
          this.cancelControllers.delete(queryKey);
        }
      }
      return;
    }
    for (const controller of this.cancelControllers.values()) {
      controller.abort();
    }
    this.cancelControllers.clear();
  }
}
