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

import { dataProvider } from '../../src/data-provider';
import { GlobalStore } from '../../src/global-store';
import { KubeSdk, Unstructured, UnstructuredList } from '../../src/kube-api';

const conflictMessage =
  '当前数据已经不是最新，请关闭表单，重新打开编辑和提交。';

function makeResource(
  resourceVersion: string,
  overrides: Partial<Unstructured> = {}
): Unstructured {
  return {
    id: 'default/test',
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: 'test',
      namespace: 'default',
      resourceVersion,
    },
    data: {
      key: 'value',
    },
    ...overrides,
  } as Unstructured;
}

function makeList(item: Unstructured): UnstructuredList {
  return {
    apiVersion: 'v1',
    kind: 'ConfigMapList',
    metadata: {},
    items: [item],
  };
}

function makeHttpError(status: number, statusText = 'Conflict') {
  return {
    response: {
      status,
      statusText,
    },
  };
}

function makeProvider(latestResource: Unstructured) {
  const get = jest.fn(async (_resource: string, _meta?: unknown) =>
    makeList(latestResource)
  );
  const restoreItem = jest.fn((item: Unstructured) => item);
  const provider = dataProvider({
    apiUrl: '/api',
    fieldManager: 'refine',
    kubeApiTimeout: false,
    plugins: [],
    get,
    restoreItem,
  } as unknown as GlobalStore);

  return {
    get,
    provider,
    restoreItem,
  };
}

function makeUpdateParams(
  resource: Unstructured,
  initialResource?: Unstructured,
  updateType: 'put' | 'patch' = 'put',
  metaOverrides: Record<string, unknown> = {}
) {
  return {
    resource: 'configmaps',
    id: 'default/test',
    variables: resource,
    meta: {
      resourceBasePath: '/api/v1',
      kind: 'ConfigMap',
      updateType,
      ...metaOverrides,
      resourceVersionConflictRetry: initialResource
        ? {
            initialResource,
            conflictMessage,
          }
        : undefined,
    },
  };
}

describe('dataProvider resourceVersion conflict retry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retries a 409 PUT when only runtime fields changed', async () => {
    const initialResource = makeResource('1', {
      status: { phase: 'Pending' },
      metadata: {
        name: 'test',
        namespace: 'default',
        resourceVersion: '1',
        annotations: {
          'kubectl.kubernetes.io/last-applied-configuration': 'old',
        },
        finalizers: ['old-finalizer'],
        managedFields: [{ manager: 'old' }],
      },
    } as Partial<Unstructured>);
    const latestResource = makeResource('2', {
      status: { phase: 'Running' },
      metadata: {
        name: 'test',
        namespace: 'default',
        resourceVersion: '2',
        annotations: {
          'kubectl.kubernetes.io/last-applied-configuration': 'new',
        },
        finalizers: ['new-finalizer'],
        managedFields: [{ manager: 'new' }],
      },
    } as Partial<Unstructured>);
    const submittedResource = makeResource('1', {
      data: { key: 'edited' },
    });
    const { get, provider } = makeProvider(latestResource);
    const applyYaml = jest
      .spyOn(KubeSdk.prototype, 'applyYaml')
      .mockRejectedValueOnce(makeHttpError(409))
      .mockResolvedValueOnce([makeResource('3')]);
    const getOne = jest
      .spyOn(KubeSdk.prototype, 'getOne')
      .mockResolvedValueOnce(latestResource);

    const result = await provider.update(
      makeUpdateParams(submittedResource, initialResource)
    );

    expect(result.data.metadata?.resourceVersion).toBe('3');
    expect(applyYaml).toHaveBeenCalledTimes(2);
    expect(applyYaml.mock.calls[1][0][0].metadata?.resourceVersion).toBe('2');
    expect(getOne).toHaveBeenCalledWith(
      expect.objectContaining({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: expect.objectContaining({
          name: 'test',
          namespace: 'default',
        }),
      })
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('ignores extractPathName when fetching the latest resource for retry', async () => {
    const initialResource = makeResource('1');
    const latestResource = makeResource('2');
    const { get, provider } = makeProvider(latestResource);
    const applyYaml = jest
      .spyOn(KubeSdk.prototype, 'applyYaml')
      .mockRejectedValueOnce(makeHttpError(409))
      .mockResolvedValueOnce([makeResource('3')]);
    const getOne = jest
      .spyOn(KubeSdk.prototype, 'getOne')
      .mockResolvedValueOnce(latestResource);

    await provider.update(
      makeUpdateParams(makeResource('1'), initialResource, 'put', {
        extractPathName: 'items',
      })
    );

    expect(applyYaml).toHaveBeenCalledTimes(2);
    expect(getOne).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
  });

  it('does not retry when latest resource has real changes', async () => {
    const initialResource = makeResource('1');
    const latestResource = makeResource('2', {
      data: { key: 'changed-by-server' },
    });
    const { provider } = makeProvider(latestResource);
    const applyYaml = jest
      .spyOn(KubeSdk.prototype, 'applyYaml')
      .mockRejectedValueOnce(makeHttpError(409));
    jest.spyOn(KubeSdk.prototype, 'getOne').mockResolvedValueOnce(latestResource);

    await expect(
      provider.update(makeUpdateParams(makeResource('1'), initialResource))
    ).rejects.toMatchObject({
      message: conflictMessage,
      statusCode: 409,
    });

    expect(applyYaml).toHaveBeenCalledTimes(1);
  });

  it('keeps original behavior for non-409 errors', async () => {
    const initialResource = makeResource('1');
    const { get, provider } = makeProvider(makeResource('2'));
    const applyYaml = jest
      .spyOn(KubeSdk.prototype, 'applyYaml')
      .mockRejectedValueOnce(makeHttpError(500, 'Internal Server Error'));
    const getOne = jest.spyOn(KubeSdk.prototype, 'getOne');

    await expect(
      provider.update(makeUpdateParams(makeResource('1'), initialResource))
    ).rejects.toMatchObject({
      statusCode: 500,
    });

    expect(applyYaml).toHaveBeenCalledTimes(1);
    expect(getOne).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps original behavior for non-PUT updates', async () => {
    const initialResource = makeResource('1');
    const { get, provider } = makeProvider(makeResource('2'));
    const applyYaml = jest
      .spyOn(KubeSdk.prototype, 'applyYaml')
      .mockRejectedValueOnce(makeHttpError(409));
    const getOne = jest.spyOn(KubeSdk.prototype, 'getOne');

    await expect(
      provider.update(makeUpdateParams(makeResource('1'), initialResource, 'patch'))
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(applyYaml).toHaveBeenCalledTimes(1);
    expect(getOne).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps original behavior when initial resource is missing', async () => {
    const { get, provider } = makeProvider(makeResource('2'));
    const applyYaml = jest
      .spyOn(KubeSdk.prototype, 'applyYaml')
      .mockRejectedValueOnce(makeHttpError(409));
    const getOne = jest.spyOn(KubeSdk.prototype, 'getOne');

    await expect(
      provider.update(makeUpdateParams(makeResource('1')))
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(applyYaml).toHaveBeenCalledTimes(1);
    expect(getOne).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('does not retry more than once', async () => {
    const initialResource = makeResource('1');
    const { provider } = makeProvider(makeResource('2'));
    const applyYaml = jest
      .spyOn(KubeSdk.prototype, 'applyYaml')
      .mockRejectedValueOnce(makeHttpError(409))
      .mockRejectedValueOnce(makeHttpError(409));
    jest
      .spyOn(KubeSdk.prototype, 'getOne')
      .mockResolvedValueOnce(makeResource('2'));

    await expect(
      provider.update(makeUpdateParams(makeResource('1'), initialResource))
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(applyYaml).toHaveBeenCalledTimes(2);
  });
});
