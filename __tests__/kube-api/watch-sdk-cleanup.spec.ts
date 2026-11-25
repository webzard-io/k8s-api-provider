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

import ky from 'ky';
import {
  KubeApi,
  KubeSdk,
  Unstructured,
  UnstructuredList,
} from '../../src/kube-api';

const mockedKy = ky as unknown as {
  get: jest.Mock;
  post: jest.Mock;
};

const pvc = {
  apiVersion: 'v1',
  kind: 'PersistentVolumeClaim',
  metadata: { name: 'pvc-b', namespace: 'default' },
} as unknown as Unstructured;

const pvcList: UnstructuredList = {
  apiVersion: 'v1',
  kind: 'PersistentVolumeClaimList',
  metadata: {},
  items: [],
};

const discovery = {
  resources: [
    {
      name: 'persistentvolumeclaims',
      kind: 'PersistentVolumeClaim',
      namespaced: true,
      verbs: ['list', 'create', 'watch'],
    },
  ],
};

function jsonResponse(data: unknown) {
  return { json: () => Promise.resolve(data) };
}

describe('KubeApi.watch sdk listener cleanup', () => {
  it('stops the sdk listener when watch setup fails, so later sdk events are not delivered', async () => {
    let discoveryCalls = 0;
    mockedKy.get.mockImplementation((url: string) => {
      if (url.endsWith('/persistentvolumeclaims')) {
        return jsonResponse(pvcList);
      }
      discoveryCalls += 1;
      // 第一次 discovery 失败，模拟 watch() 注册 sdk 监听后建立失败
      if (discoveryCalls === 1) {
        return { json: () => Promise.reject(new Error('discovery failed')) };
      }
      return jsonResponse(discovery);
    });
    mockedKy.post.mockImplementation(() => jsonResponse(pvc));

    const api = new KubeApi<UnstructuredList>({
      basePath: '/k8s',
      objectConstructor: {
        resourceBasePath: '/api/v1',
        resource: 'persistentvolumeclaims',
      },
    });
    const onResponse = jest.fn();

    await expect(api.listWatch({ onResponse })).rejects.toThrow(
      'discovery failed'
    );

    const sdk = new KubeSdk({ basePath: '/k8s' }, []);
    await sdk.createyYaml([pvc]);

    expect(onResponse).not.toHaveBeenCalled();
  });
});
