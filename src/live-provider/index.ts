import { LiveEvent, LiveProvider } from '@refinedev/core';
import { StopWatchHandler, WatchEvent, Unstructured } from '../kube-api';
import { getId } from '../data-provider';

import { GlobalStore } from '../global-store';

const eventTypeMap: Record<WatchEvent['type'], LiveEvent['type']> = {
  ADDED: 'created',
  MODIFIED: 'updated',
  DELETED: 'deleted',
  PING: 'ping',
};
function getKey<T extends WatchEvent['type']>(value: LiveEvent['type']): T {
  return (Object.keys(eventTypeMap) as Array<keyof typeof eventTypeMap>).find(
    key => eventTypeMap[key] === value
  ) as T;
}
function getSelectedGlobalStore(
  globalStore: GlobalStore | GlobalStore[],
  dataProviderName?: string
) {
  return Array.isArray(globalStore)
    ? globalStore.find(item => item.prefix === dataProviderName)
    : globalStore;
}
export const liveProvider = (
  globalStore: GlobalStore | GlobalStore[]
): LiveProvider => ({
  subscribe: ({ channel, params, callback }) => {
    const { resource } = params ?? {};
    if (!resource) {
      throw new Error(
        '[WatchApi]: `resource` is required in `params` for k8s watch and globalStore'
      );
    }
    const selectedGlobalStore = getSelectedGlobalStore(
      globalStore,
      params?.dataProviderName
    );
    if (!selectedGlobalStore) {
      throw new Error(
        '[WatchApi]: `GlobalStore` is required in `params` for k8s live provider, can not find matched `GlobalStore`'
      );
    }
    const stop = selectedGlobalStore.subscribe(resource, event => {
      const id = getId(event.object);
      callback({
        channel,
        type: eventTypeMap[event.type] || event.type,
        date: new Date(),
        payload: {
          ids: [id],
          object: event.object,
        },
      });
    });

    return {
      stop,
    };
  },
  unsubscribe: ({ stop }: Partial<{ stop: StopWatchHandler }>) => {
    stop?.();
  },
  publish: (event: LiveEvent) => {
    const selectedGlobalStore = getSelectedGlobalStore(
      globalStore,
      event.meta?.dataProviderName
    );
    if (!selectedGlobalStore) {
      throw new Error(
        '[WatchApi]: `GlobalStore` is required in `params` for k8s live provider, can not find matched `GlobalStore`'
      );
    }
    const eventType = getKey(event.type);
    const [, resource] = event.channel.split('/');
    if (!resource) {
      throw new Error(
        '[WatchApi]: `resource` is required in `params` for k8s watch and globalStore'
      );
    }
    selectedGlobalStore.publish(resource, {
      type: eventType,
      object: event.payload as Unstructured,
    });
  },
});
