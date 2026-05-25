import { BaseRecord, HttpError } from '@refinedev/core';
import { cloneDeep, isEqual, unset } from 'lodash-es';
import { Unstructured } from '../kube-api';

export type ResourceVersionConflictRetryOptions = {
  initialResource?: Unstructured;
  conflictMessage?: string;
};

type RetryResourceVersionConflictParams<TData extends BaseRecord> = {
  error: HttpError;
  initialResource?: Unstructured;
  conflictMessage?: string;
  getLatestResource: () => Promise<Unstructured>;
  apply: (resource: Unstructured) => Promise<TData>;
  resource: Unstructured;
};

const DEFAULT_CONFLICT_MESSAGE =
  'The current data is no longer up to date. Please close the form, reopen it, edit again, and submit.';

export function isResourceVersionConflict(error: HttpError) {
  return error.statusCode === 409;
}

export function normalizeResourceForConflictCompare(resource: Unstructured) {
  const result = cloneDeep(resource) as Unstructured;

  // 这些字段不需要加入冲突比较
  unset(result, 'id');
  unset(result, 'status');
  unset(result, 'metadata.resourceVersion');
  unset(result, 'metadata.managedFields');
  unset(result, 'metadata.relations');
  unset(result, 'metadata.finalizers');
  unset(result, [
    'metadata',
    'annotations',
    'kubectl.kubernetes.io/last-applied-configuration',
  ]);

  if (
    result.metadata?.annotations &&
    Object.keys(result.metadata.annotations).length === 0
  ) {
    unset(result, 'metadata.annotations');
  }

  return result;
}

export function isSameResourceExceptRuntimeFields(
  initialResource: Unstructured,
  latestResource: Unstructured
) {
  return isEqual(
    normalizeResourceForConflictCompare(initialResource),
    normalizeResourceForConflictCompare(latestResource)
  );
}

export async function retryResourceVersionConflict<TData extends BaseRecord>({
  error,
  initialResource,
  conflictMessage = DEFAULT_CONFLICT_MESSAGE,
  getLatestResource,
  apply,
  resource,
}: RetryResourceVersionConflictParams<TData>): Promise<TData> {
  if (!isResourceVersionConflict(error) || !initialResource) {
    throw error;
  }

  const latestResource = await getLatestResource();
  const latestResourceVersion = latestResource.metadata?.resourceVersion;

  // 只有服务端最新版本和编辑初始版本除运行时字段外完全一致时，才允许自动重试。
  if (
    !latestResourceVersion ||
    !isSameResourceExceptRuntimeFields(initialResource, latestResource)
  ) {
    throw {
      message: conflictMessage,
      statusCode: 409,
    } as HttpError;
  }

  const retryResource = cloneDeep(resource);
  retryResource.metadata = retryResource.metadata || {};
  // 把服务端最新的 resourceVersion 覆盖到用户要保存的版本，避免覆盖服务端真实变更。
  (retryResource.metadata as Record<string, unknown>).resourceVersion =
    latestResourceVersion;

  return apply(retryResource);
}
