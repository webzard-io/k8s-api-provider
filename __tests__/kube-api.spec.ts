jest.mock('ky', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import ky from 'ky';
import { IProviderPlugin } from '../src/plugin';
import { KubeSdk, Unstructured, UnstructuredList } from '../src/kube-api';

function makePlugin(): IProviderPlugin {
  return {
    init: jest.fn(),
    processData: jest.fn(async data => data),
    processItem: jest.fn(async item => item),
    restoreData: jest.fn(data => data),
    restoreItem: jest.fn(() => undefined as unknown as Unstructured),
  };
}

describe('KubeSdk', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('gets one resource without restoring plugin fields', async () => {
    const plugin = makePlugin();
    const get = ky.get as jest.Mock;

    get
      .mockReturnValueOnce({
        json: async () => ({
          resources: [
            {
              kind: 'ConfigMap',
              name: 'configmaps',
              namespaced: true,
            },
          ],
        }),
      })
      .mockReturnValueOnce({
        json: async () =>
          ({
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: {
              name: 'test',
              namespace: 'default',
              resourceVersion: '2',
            },
          } as Unstructured),
      });

    const sdk = new KubeSdk(
      {
        basePath: '/api',
      },
      [plugin]
    );

    const result = await sdk.getOne({
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'test',
        namespace: 'default',
      },
    } as Unstructured);

    expect(plugin.restoreItem).not.toHaveBeenCalled();
    expect(result.metadata?.resourceVersion).toBe('2');
    expect(get).toHaveBeenLastCalledWith(
      '/api/api/v1/namespaces/default/configmaps/test',
      expect.objectContaining({
        retry: 0,
      })
    );
  });
});
