import {
  DataProvider,
  BaseRecord,
  GetListResponse,
  GetOneResponse,
  GetManyResponse,
  BaseKey,
  CreateResponse,
  MetaQuery,
  UpdateResponse,
  DeleteOneResponse,
} from '@refinedev/core';
import { KubeSdk, Unstructured } from '../kube-api';
import { filterData } from '../utils/filter-data';
import { sortData } from '../utils/sort-data';
import { paginateData } from '../utils/paginate-data';
import { GlobalStore } from '../global-store';
import { transformHttpError } from '../utils/transform-http-error';

export function getId(obj: Unstructured) {
  if (!obj.metadata?.namespace) {
    return obj.metadata?.name || '';
  }
  return `${obj.metadata?.namespace}/${obj.metadata?.name}`;
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
  const getOne = async <TData extends BaseRecord = BaseRecord>(
    params: Parameters<DataProvider['getOne']>['0']
  ): Promise<GetOneResponse<TData>> => {
    try {
      const { resource, id, meta } = params;
      const idParts = id.toString().split('/');
      const [namespace, name] =
        idParts.length === 1 ? [undefined, idParts[0]] : idParts;
      const { items, kind, apiVersion } = await globalStore.get(resource, meta);
      const data = items.find(
        item =>
          item.metadata.name === name && item.metadata.namespace === namespace
      );
      if (!data) {
        throw new Error(`resource: ${resource} not include id: ${id}`);
      }
      return {
        data: {
          ...data,
          id: getId(data),
          kind: kind.replace(/List$/g, ''),
          apiVersion: apiVersion,
        } as unknown as TData,
      };
    } catch (e) {
      const httpError = transformHttpError(e);
      throw httpError;
    }
  };

  return {
    getList: async <TData extends BaseRecord = BaseRecord>(
      params: Parameters<DataProvider['getList']>['0']
    ): Promise<GetListResponse<TData>> => {
      try {
        const { resource, pagination, filters, sorters, meta } = params;
        let { items } = await globalStore.get<TData>(resource, meta);

        if (filters) {
          items = filterData(filters, items);
        }

        if (sorters) {
          items = sortData(sorters, items);
        }
        const _total = items.length;

        if (pagination) {
          items = paginateData(pagination, items);
        }

        return {
          data: items.map((item: Unstructured) => ({
            ...item,
            id: getId(item),
          })),
          total: _total,
        };
      } catch (e) {
        const httpError = transformHttpError(e);
        throw httpError;
      }
    },

    getMany: async <
      TData extends BaseRecord = BaseRecord,
      TVariables = unknown,
    >(params: {
      resource: string;
      ids: BaseKey[];
      variables?: TVariables | undefined;
      meta?: MetaQuery | undefined;
      metaData?: MetaQuery | undefined;
    }): Promise<GetManyResponse<TData>> => {
      try {
        const { ids, ...rest } = params;
        const data = await Promise.all(
          ids.map(id => getOne({ id, ...rest }).then(v => v.data))
        );

        return {
          data: data as unknown as TData[],
        };
      } catch (e) {
        const httpError = transformHttpError(e);
        throw httpError;
      }
    },

    create: async <TData extends BaseRecord = BaseRecord>({
      variables,
      meta,
    }: Parameters<DataProvider['create']>['0']): Promise<
      CreateResponse<TData>
    > => {
      const sdk = new KubeSdk({
        basePath: globalStore.apiUrl,
        fieldManager: globalStore.fieldManager,
        kubeApiTimeout: globalStore.kubeApiTimeout,
      });
      try {
        const data = await sdk.createyYaml([
          {
            ...(variables as unknown as Unstructured),
            apiVersion: getApiVersion(meta?.resourceBasePath),
            kind: meta?.kind,
          },
        ]);

        return {
          data: data[0] as unknown as TData,
        };
      } catch (e) {
        const httpError = transformHttpError(e);
        throw httpError;
      }
    },

    update: async <TData extends BaseRecord = BaseRecord>({
      variables,
      meta,
    }: Parameters<DataProvider['update']>['0']): Promise<
      UpdateResponse<TData>
    > => {
      try {
        const sdk = new KubeSdk({
          basePath: globalStore.apiUrl,
          fieldManager: globalStore.fieldManager,
        });
        const params = [
          {
            ...(variables as unknown as Unstructured),
            apiVersion: getApiVersion(meta?.resourceBasePath),
            kind: meta?.kind,
          },
        ];
        const data = await sdk.applyYaml(
          params,
          meta?.strategy,
          meta?.replacePaths
        );

        return {
          data: data[0] as unknown as TData,
        };
      } catch (e) {
        const httpError = transformHttpError(e);
        throw httpError;
      }
    },

    getOne,

    deleteOne: async <TData extends BaseRecord = BaseRecord>({
      resource,
      id,
      meta,
      ...rest
    }: Parameters<DataProvider['deleteOne']>['0']): Promise<
      DeleteOneResponse<TData>
    > => {
      try {
        const sdk = new KubeSdk({
          basePath: globalStore.apiUrl,
          fieldManager: globalStore.fieldManager,
          kubeApiTimeout: globalStore.kubeApiTimeout,
        });
        const { data: current } = await getOne({ id, resource, meta, ...rest });

        const data = await sdk.deleteYaml([current as Unstructured]);

        return {
          data: data[0] as unknown as TData,
        };
      } catch (e) {
        const httpError = transformHttpError(e);
        throw httpError;
      }
    },

    getApiUrl: () => {
      return globalStore.apiUrl;
    },
  };
};
