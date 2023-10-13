import { dataProvider } from './data-provider';
export default dataProvider;

export * from './data-provider';
export * from './live-provider';
export * from './utils';
export * from './global-store';
export * from './kube-api';

export type { Relation, ExtendObjectMeta } from './plugins/relation';
export { relationPlugin } from './plugins/relation';
