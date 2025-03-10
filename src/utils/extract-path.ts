import { get } from 'lodash-es';
import { Unstructured } from '../kube-api';

interface ExtractedMetadata {
  name: string;
  namespace?: string;
}

function ensureMetadata(
  item: Partial<Unstructured>,
  parentItem?: Unstructured,
  index?: number
): ExtractedMetadata {
  const parentName = parentItem?.metadata?.name;
  const name = item?.metadata?.name ?? 
    (parentName ? `${parentName}-${index}` : `unnamed-${index}`);
  
  const namespace = item?.metadata?.namespace ?? parentItem?.metadata?.namespace ?? '';
  
  return { name, namespace };
}

export const extractPath = (extractPathName: string, items: Unstructured[]): Unstructured[] => {
  if (!items?.length) {
    return [];
  }

  // Parse the parent index from extractPathName
  const parentIndex = extractPathName.match(/^\[(\d+)\]/)?.[1];
  const parentItem = parentIndex !== undefined ? items[parseInt(parentIndex, 10)] : items[0];
  const extractedData = get(items, extractPathName);
  
  if (!extractedData) {
    return [];
  }

  const extractedItems = Array.isArray(extractedData) ? extractedData : [extractedData];

  return extractedItems.map((item, index) => ({
    ...item,
    metadata: {
      ...parentItem?.metadata,
      ...ensureMetadata(item, parentItem, index),
    },
  }));
}