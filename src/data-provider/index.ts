import { DataProvider, BaseRecord, GetListResponse, GetOneResponse } from '@refinedev/core';
import { KubeSdk, Unstructured } from '../kube-api';
import { filterData } from '../utils/filter-data';
import { sortData } from '../utils/sort-data';
import { paginateData } from '../utils/paginate-data';
import { GlobalStore } from '../global-store';

export function getId(obj: Unstructured) {
  if (!obj.metadata.namespace) {
    return obj.metadata.name || '';
  }
  return `${obj.metadata.namespace}/${obj.metadata.name}`;
}

  function getApiVersion(resourceBasePath: string): string {
    return resourceBasePath.replace(/^(\/api\/)|(\/apis\/)/, '');
  }

export const dataProvider = (
  globalStore: GlobalStore
): Omit<
  Required<DataProvider>,
  'createMany' | 'updateMany' | 'deleteMany' | 'custom'
> => {
  const getOne = async<TData extends BaseRecord = BaseRecord> (params: Parameters<DataProvider['getOne']>['0']):Promise<GetOneResponse<TData>> => {
    const { resource, id, meta } = params
    const idParts = id.toString().split('/');
    const [namespace, name] =
      idParts.length === 1 ? [undefined, idParts[0]] : idParts;
    const { items, kind, apiVersion } = await globalStore.get(resource, meta);

    const data = items.find(
      item =>
        item.metadata.name === name && item.metadata.namespace === namespace
    );

    return {
      data: (data
        ? {
            ...data,
            id: getId(data),
            kind: kind.replace(/List$/g, ''),
            apiVersion: apiVersion,
          }
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
          null) as any,
    };
  };

  return {
    getList: async <TData extends BaseRecord = BaseRecord>(
      params: Parameters<DataProvider['getList']>['0']
    ): Promise<GetListResponse<TData>> => {
      const { resource, pagination, filters, sorters, meta } = params;

      let { items } = await globalStore.get<TData>(resource, meta);

      if (filters) {
        items = filterData(filters, items);
      }

      if (sorters) {
        items = sortData(sorters, items);
      }

      if (pagination) {
        items = paginateData(pagination, items);
      }

      return {
        data: items.map((item: Unstructured) => ({
          ...(item),
          id: getId(item),
        })),
        total: items.length,
      };
    },

    getMany: async ({ ids, ...rest }) => {
      const data = await Promise.all(
        ids.map(id => getOne({ id, ...rest }).then(v => v.data))
      );

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data as any,
      };
    },

    create: async ({ variables, meta }) => {
      const sdk = new KubeSdk({
        basePath: globalStore.apiUrl,
      });

      const data = await sdk.applyYaml([
        {
          ...(variables as unknown as Unstructured),
          apiVersion: getApiVersion(meta?.resourceBasePath),
          kind: meta?.kind,
        },
      ]);

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data[0] as any,
      };
    },

    update: async ({ variables, meta }) => {
      const sdk = new KubeSdk({
        basePath: globalStore.apiUrl,
      });

      const data = await sdk.applyYaml([
        {
          ...(variables as unknown as Unstructured),
          apiVersion: getApiVersion(meta?.resourceBasePath),
          kind: meta?.kind,
        },
      ]);

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data[0] as any,
      };
    },

    getOne,

    deleteOne: async ({ resource, id, meta, ...rest }) => {
      const sdk = new KubeSdk({
        basePath: globalStore.apiUrl,
      });

      const { data: current } = await getOne({ id, resource, meta, ...rest });

      const data = await sdk.deleteYaml([current as Unstructured]);

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data[0] as any,
      };
    },

    getApiUrl: () => {
      return globalStore.apiUrl;
    },
  };
};
