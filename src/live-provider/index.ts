import { LiveEvent, LiveProvider } from '@refinedev/core';
import { StopWatchHandler } from '../kube-api';
import { WatchEvent } from 'kubernetes-types/meta/v1';
import { getId } from '../data-provider';

import { GlobalStore } from '../global-store';

const eventTypeMap: Record<WatchEvent['type'], LiveEvent['type']> = {
  ADDED: 'created',
  MODIFIED: 'updated',
  DELETED: 'deleted',
};

export const liveProvider = (globalStore: GlobalStore): LiveProvider => ({
  subscribe: ({ channel, params, callback }) => {
    const { resource } = params ?? {};
    if (!resource) {
      throw new Error(
        '[WatchApi]: `resource` is required in `params` for k8s watch and globalStore'
      );
    }
    const stop = globalStore.subscribe(resource, event => {
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
  publish: () => {
    // TODO(xingyu): implement publish
    // console.log("publish", { event });
  },
});
