import { ProviderPlugins } from '../../src/plugins';
import { RawDeploymentList, RawPodList } from './mock';
import { UnstructuredList } from '../../src/kube-api';

describe('Relation Plugin', () => {
  it('adds relations', async () => {
    const relationPlugin = ProviderPlugins[0];
    const result = await relationPlugin.processData(
      RawDeploymentList as UnstructuredList
    );
    expect((result.items[0].metadata as any).relations).toEqual([
      {
        kind: 'Pod',
        apiVersion: 'v1',
        type: 'creates',
        selector: {
          matchLabels: {
            'app.kubernetes.io/component': 'controller',
            'app.kubernetes.io/instance': 'cert-manager',
            'app.kubernetes.io/name': 'cert-manager',
          },
        },
        inbound: false,
      },
    ]);
    expect((result.items[1].metadata as any).relations).toEqual([
      {
        kind: 'Pod',
        apiVersion: 'v1',
        type: 'creates',
        selector: { matchLabels: { app: 'everoute-operator' } },
        inbound: false,
      },
    ]);
  });
});
