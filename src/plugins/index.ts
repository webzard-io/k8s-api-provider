import { modelPlugin } from './model-plugin/model-plugin';
import { relationPlugin } from './relation-plugin';
import { IProviderPlugin } from './type';

export const ProviderPlugins = [
  relationPlugin,
  modelPlugin,
] as IProviderPlugin[];
