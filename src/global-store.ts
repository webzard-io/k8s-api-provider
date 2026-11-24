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

export enum RequestMode {
  NetworkOnly = 'network-only',
}

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

export type KubeApiFactory = (params: {
  basePath: string;
  watchWsBasePath?: string;
  objectConstructor: ReturnType<typeof getObjectConstructor>;
  kubeApiTimeout?: false | number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) => KubeApi<any>;

export interface GlobalStoreInitParams {
  apiUrl: string;
  watchWsApiUrl?: string;
  prefix?: string;
  fieldManager?: string;
  kubeApiTimeout?: false | number;
  plugins?: IProviderPlugin[];
  kubeApiFactory?: KubeApiFactory;
}
export interface CancelQueriesParams {
  queryKeys?: string[];
}
export class GlobalStore {
  private _apiUrl = '';
  private watchWsApiUrl?: string;
  prefix?: string;
  fieldManager?: string;

  private _isDestroyed = false;
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
  private kubeApiFactory: KubeApiFactory;

  constructor(
    params: GlobalStoreInitParams,
    public plugins: IProviderPlugin[]
  ) {
    this.kubeApiFactory =
      params.kubeApiFactory || (apiParams => new KubeApi(apiParams));
    this.init(params);
  }

  get apiUrl() {
    return this._apiUrl;
  }

  get kubeApiTimeout() {
    return this._kubeApiTimeout;
  }
  get isDestroyed() {
    return this._isDestroyed;
  }
  // clear cache request
  removeCacheRequest(targetPromise: Promise<unknown>) {
    const cacheRequestIndex = this.requestsCache.findIndex(f => {
      return f.promise === targetPromise;
    });
    if (cacheRequestIndex > -1) {
      this.requestsCache.splice(cacheRequestIndex, 1);
    }
  }

  get<T = UnstructuredList>(resource: string, meta?: MetaQuery): Promise<T> {
    if (this._isDestroyed) {
      return Promise.reject('GlobalStore has been destroyed');
    }

    if (this.store.has(resource) && meta?.mode !== RequestMode.NetworkOnly) {
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
      const kubeApi = this.kubeApiFactory({
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
          namespace: meta?.namespace,
          onResponse: async (res, event) => {
            if (this._isDestroyed) {
              console.error('GlobalStore has been destroyed');
              return;
            }

            // 单个 watch 事件只把该事件增量合并进 store，不能用事件携带的整表快照覆盖：
            // 快照来自 watch 闭包，在断线重连/退避窗口内可能滞后于 store，
            // 整表覆盖会让 store 回退到旧数据（SKS-4812：PVC 状态从 Bound 回退成 Pending）
            if (
              event &&
              event.type !== 'PING' &&
              (await this.mergeEventIntoStore(resource, event))
            ) {
              // 请求缓存留给下方首次整表响应移除，避免在 resolve 前被移除导致重复建立 listWatch
              return;
            }

            const processedRes = await this.processList(res);
            if (!resolved) {
              resolve(processedRes as unknown as T);
              resolved = true;
            }

            this.store.set(resource, processedRes);
            if (event) {
              const object = await this.processItem(event.object);
              this.notify(resource, { ...event, object });
            }
            // TODO: if the request onResponse is timeout, the cache request will not be removed
            this.removeCacheRequest(promise);
          },
          signal,
        })
        .then(stop => {
          if (this._isDestroyed) {
            stop?.();
            return;
          }
          this.stopWatchHandlers.set(resource, stop);
        })
        .catch(e => {
          this.removeCacheRequest(promise);
          reject(e);
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

  /**
   * 把单个 watch 事件增量合并进 store 缓存。
   * 返回是否已有缓存可合并；没有缓存时由调用方决定如何初始化。
   */
  private async mergeEventIntoStore(
    resource: string,
    event: WatchEvent
  ): Promise<boolean> {
    // 该资源还没有被 list 过，没有可以合并的缓存
    if (!this.store.has(resource)) {
      return false;
    }

    const object = await this.processItem({ ...event.object });
    // 必须在 await 之后读缓存：多个事件会并发合并，提前读会拿到旧缓存并覆盖其他事件的结果
    const cached = this.store.get(resource);
    // 处理期间 store 被销毁
    if (!cached) {
      return true;
    }
    const index = cached.items.findIndex(
      item =>
        item.metadata?.name === object.metadata?.name &&
        item.metadata?.namespace === object.metadata?.namespace
    );

    let items: Unstructured[];
    if (event.type === 'DELETED') {
      if (index === -1) {
        return true;
      }
      items = cached.items.filter((_, i) => i !== index);
    } else if (index === -1) {
      // MODIFIED 却不在缓存里，说明对象已被移出当前列表，不能再加回去
      if (event.type === 'MODIFIED') {
        return true;
      }
      items = [...cached.items, object];
    } else {
      items = cached.items.map((item, i) => (i === index ? object : item));
    }

    this.store.set(resource, { ...cached, items });
    this.notify(resource, { ...event, object });
    return true;
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
      kubeApiFactory,
    } = params;

    if (kubeApiFactory) {
      this.kubeApiFactory = kubeApiFactory;
    }

    this._isDestroyed = false;
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
    this._isDestroyed = true;
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
