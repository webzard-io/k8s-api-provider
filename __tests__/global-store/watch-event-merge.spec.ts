jest.mock('ky', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

import { GlobalStore, RequestMode } from '../../src/global-store';
import { Unstructured, UnstructuredList, WatchEvent } from '../../src/kube-api';

type OnResponse = (res: UnstructuredList, event?: WatchEvent) => Promise<void>;

function makePvc(name: string, phase: string): Unstructured {
  return {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: {
      name,
      namespace: 'default',
    },
    status: { phase },
  } as unknown as Unstructured;
}

function makeList(items: Unstructured[]): UnstructuredList {
  return {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaimList',
    metadata: {},
    items,
  };
}

// 注入假 KubeApi 捕获 onResponse，模拟 list 响应与 watch 事件的推送时序
async function makeStoreWithWatch(initialItems: Unstructured[]) {
  let onResponse: OnResponse | undefined;
  const store = new GlobalStore(
    {
      apiUrl: '/api',
      plugins: [],
      kubeApiFactory: () =>
        ({
          listWatch: async (params: { onResponse: OnResponse }) => {
            onResponse = params.onResponse;
            await onResponse(makeList(initialItems));
            return () => undefined;
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    },
    []
  );

  await store.get('persistentvolumeclaims', { resourceBasePath: '/api/v1' });

  return { store, pushEvent: (res: UnstructuredList, event?: WatchEvent) => onResponse!(res, event) };
}

async function getCachedNames(store: GlobalStore) {
  const cached = await store.get<UnstructuredList>('persistentvolumeclaims', {
    resourceBasePath: '/api/v1',
  });
  return cached.items;
}

describe('GlobalStore watch event merge', () => {
  it('does not roll back newer store data when an event carries a stale list snapshot (SKS-4812)', async () => {
    const { store, pushEvent } = await makeStoreWithWatch([
      makePvc('pvc-a', 'Pending'),
    ]);

    // watch 推送 pvc-a 变为 Bound
    await pushEvent(makeList([makePvc('pvc-a', 'Bound')]), {
      type: 'MODIFIED',
      object: makePvc('pvc-a', 'Bound'),
    });

    let items = await getCachedNames(store);
    expect(items[0].status.phase).toBe('Bound');

    // 陈旧闭包场景：事件携带的整表快照里 pvc-a 还是 Pending，
    // 但事件本身只是新增 pvc-b，不应把 pvc-a 回滚成 Pending
    await pushEvent(
      makeList([makePvc('pvc-a', 'Pending'), makePvc('pvc-b', 'Pending')]),
      {
        type: 'ADDED',
        object: makePvc('pvc-b', 'Pending'),
      }
    );

    items = await getCachedNames(store);
    expect(items.map(item => item.metadata?.name)).toEqual(['pvc-a', 'pvc-b']);
    expect(items.find(item => item.metadata?.name === 'pvc-a')?.status.phase).toBe(
      'Bound'
    );
    expect(items.find(item => item.metadata?.name === 'pvc-b')?.status.phase).toBe(
      'Pending'
    );
  });

  it('applies MODIFIED events from watch to the cached item', async () => {
    const { store, pushEvent } = await makeStoreWithWatch([
      makePvc('pvc-a', 'Pending'),
    ]);

    await pushEvent(makeList([makePvc('pvc-a', 'Bound')]), {
      type: 'MODIFIED',
      object: makePvc('pvc-a', 'Bound'),
    });

    const items = await getCachedNames(store);
    expect(items).toHaveLength(1);
    expect(items[0].status.phase).toBe('Bound');
    expect(items[0].id).toBe('default/pvc-a');
  });

  it('removes the cached item on DELETED events from watch', async () => {
    const { store, pushEvent } = await makeStoreWithWatch([
      makePvc('pvc-a', 'Bound'),
      makePvc('pvc-b', 'Pending'),
    ]);

    await pushEvent(makeList([makePvc('pvc-a', 'Bound')]), {
      type: 'DELETED',
      object: makePvc('pvc-b', 'Pending'),
    });

    const items = await getCachedNames(store);
    expect(items.map(item => item.metadata?.name)).toEqual(['pvc-a']);
  });

  it('does not resurrect a deleted item on MODIFIED events from watch', async () => {
    const { store, pushEvent } = await makeStoreWithWatch([
      makePvc('pvc-a', 'Bound'),
    ]);

    // 竞态：对象已被删除，迟到的 MODIFIED 事件不应把它加回来
    await pushEvent(
      makeList([makePvc('pvc-a', 'Bound'), makePvc('pvc-gone', 'Bound')]),
      {
        type: 'MODIFIED',
        object: makePvc('pvc-gone', 'Bound'),
      }
    );

    const items = await getCachedNames(store);
    expect(items.map(item => item.metadata?.name)).toEqual(['pvc-a']);
  });

  it('replaces the whole cached list on a full relist without event', async () => {
    const { store, pushEvent } = await makeStoreWithWatch([
      makePvc('pvc-a', 'Pending'),
    ]);

    // 无 event 的响应是真实的全量 relist（首次 list 或断线重连），应整表替换
    await pushEvent(makeList([makePvc('pvc-b', 'Bound')]));

    const items = await getCachedNames(store);
    expect(items.map(item => item.metadata?.name)).toEqual(['pvc-b']);
  });

  it('notifies subscribers when a watch event is merged', async () => {
    const { store, pushEvent } = await makeStoreWithWatch([
      makePvc('pvc-a', 'Pending'),
    ]);
    const onEvent = jest.fn();
    store.subscribe('persistentvolumeclaims', onEvent);

    await pushEvent(makeList([makePvc('pvc-a', 'Bound')]), {
      type: 'MODIFIED',
      object: makePvc('pvc-a', 'Bound'),
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].type).toBe('MODIFIED');
    expect(onEvent.mock.calls[0][0].object.id).toBe('default/pvc-a');
  });

  it('resolves a network-only request even if a watch event arrives before its relist response', async () => {
    let callCount = 0;
    const store = new GlobalStore(
      {
        apiUrl: '/api',
        plugins: [],
        kubeApiFactory: () =>
          ({
            listWatch: async (params: { onResponse: OnResponse }) => {
              callCount += 1;
              if (callCount === 1) {
                await params.onResponse(makeList([makePvc('pvc-a', 'Pending')]));
                return () => undefined;
              }
              // KubeApi.listWatch 在 watch() 建立期间就可能收到事件，之后才回调首次 list 响应
              await params.onResponse(makeList([makePvc('pvc-a', 'Bound')]), {
                type: 'MODIFIED',
                object: makePvc('pvc-a', 'Bound'),
              });
              await params.onResponse(makeList([makePvc('pvc-a', 'Bound')]));
              return () => undefined;
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      },
      []
    );
    await store.get('persistentvolumeclaims', { resourceBasePath: '/api/v1' });

    const result = await store.get<UnstructuredList>('persistentvolumeclaims', {
      resourceBasePath: '/api/v1',
      mode: RequestMode.NetworkOnly,
    });

    expect(result.items[0].status.phase).toBe('Bound');
  });
});
