import { PodModel, WorkloadModel } from '../../src/plugins/model-plugin/model';
import { RawDeploymentList, RawPodList, mockGlobalStore } from './mock';
import { Deployment, DeploymentSpec } from 'kubernetes-types/apps/v1';
import { modelPlugin } from '../../src/plugins/model-plugin/model-plugin';
import { UnstructuredList } from '../../src/kube-api';

describe('PodModel', () => {
  modelPlugin.init(mockGlobalStore as any);

  it('format Pod', async () => {
    const podList = await modelPlugin.processData(
      RawPodList as UnstructuredList
    );
    const podModel = podList.items[0] as PodModel;

    expect(podModel.imageNames).toEqual([
      'quay.io/jetstack/cert-manager-controller:v1.8.0',
    ]);
    expect(podModel.restartCount).toEqual(5);
    expect(podModel.readyDisplay).toEqual('1/1');
    expect(podModel.id).toEqual('cert-manager/cert-manager-7d6d974dbf-drn4r');
    expect(podModel.name).toEqual('cert-manager-7d6d974dbf-drn4r');
    expect(podModel.spec!.restartPolicy).toEqual('Always');
    expect(podModel.metadata!.name).toEqual('cert-manager-7d6d974dbf-drn4r');
    expect(typeof podModel.restore).toBe('function');
  });

  it('deploymentModel can scale', async () => {
    const deploymentList = await modelPlugin.processData(
      RawDeploymentList as UnstructuredList
    );
    const deploymentModel = deploymentList.items[0] as WorkloadModel;
    const newDeploymentYaml = deploymentModel.scale(5) as Deployment;

    expect(newDeploymentYaml.spec!.replicas).toEqual(5);
    expect((deploymentModel.spec as DeploymentSpec).replicas).toEqual(1);
    expect((deploymentModel._rawYaml.spec as DeploymentSpec).replicas).toEqual(
      1
    );
  });
});
