// @ts-ignore
import { extractPath } from '../../src/utils/extract-path';
import { Unstructured } from '../../src/kube-api';

describe('extractPath', () => {
  const mockItems = [
    {
      id: '1',
      metadata: {
        name: 'parent',
        namespace: 'default'
      },
      spec: {
        name: 'test',
        namespace: 'default',
        containers: [
          {
            name: 'container1',
            image: 'image1'
          },
          {
            name: 'container2',
            image: 'image2'
          }
        ]
      }
    },
    {
      id: '2',
      metadata: {
        name: 'parent2',
        namespace: 'test'
      },
      spec: {
        containers: [
          {
            name: 'container3',
            image: 'image3'
          }
        ]
      }
    }
  ];

  test('should return empty array when items is empty', () => {
    expect(extractPath('spec.containers', [])).toEqual([]);
  });

  test('should extract containers from first item when no index specified', () => {
    const result = extractPath('[0].spec.containers', mockItems);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'container1',
      image: 'image1',
      metadata: {
        name: 'parent-0',
        namespace: 'default'
      }
    });
    expect(result[1]).toEqual({
      name: 'container2',
      image: 'image2',
      metadata: {
        name: 'parent-1',
        namespace: 'default'
      }
    });
  });

  test('should extract containers from specified index', () => {
    const result = extractPath('[1].spec.containers', mockItems);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'container3',
      image: 'image3',
      metadata: {
        name: 'parent2-0',
        namespace: 'test'
      }
    });
    // un matched
    const result1 = extractPath('spec.containers', mockItems);
    expect(result1).toEqual([]);
  });

  test('should handle non-array extracted data', () => {
    const result = extractPath('[0].metadata', mockItems);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      metadata: { 
        name: 'parent-0',
        namespace: 'default'
      },
      name: 'parent',
      namespace: 'default'
    });
  });

  test('should handle items without metadata', () => {
    const itemsWithoutMetadata = [
      {
        spec: {
          containers: [
            {
              name: 'container1',
              image: 'image1'
            }
          ]
        }
      }
    ];

    const result = extractPath('[0].spec.containers', itemsWithoutMetadata as unknown as Unstructured[]);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'container1',
      image: 'image1',
      metadata: {
        name: 'unnamed-0',
        namespace: ''
      }
    });
  });

  it('should return empty array when input items is undefined', () => {
    expect(extractPath('spec.containers', undefined as unknown as Unstructured[])).toEqual([]);
  });

  it('should return empty array when path does not exist', () => {
    const items = [{
      id: 'test-pod',
      metadata: { name: 'test-pod' },
      spec: {}
    } as unknown as Unstructured];
    expect(extractPath('spec.nonexistent', items)).toEqual([]);
  });

  it('should extract single item from path', () => {
    const items = [{
      id: 'test-pod',
      metadata: {
        name: 'test-pod',
        namespace: 'default'
      },
      spec: {
        container: {
          name: 'nginx'
        }
      }
    } as unknown as Unstructured];

    const expected = [{
      name: 'nginx',
      metadata: {
        name: 'test-pod-0',
        namespace: 'default'
      }
    }];

    expect(extractPath('[0].spec.container', items)).toEqual(expected);
  });

  it('should extract array items from path', () => {
    const items = [{
      metadata: {
        name: 'test-pod',
        namespace: 'default'
      },
      spec: {
        containers: [
          { name: 'nginx' },
          { name: 'sidecar' }
        ]
      }
    } as unknown as Unstructured];

    const expected = [
      {
        name: 'nginx',
        metadata: {
          name: 'test-pod-0',
          namespace: 'default'
        }
      },
      {
        name: 'sidecar',
        metadata: {
          name: 'test-pod-1',
          namespace: 'default'
        }
      }
    ];

    expect(extractPath('[0].spec.containers', items)).toEqual(expected);
  });

  it('should generate name when item has no name', () => {
    const items = [{
      id: 'test-pod',
      metadata: {
        name: 'test-pod',
        namespace: 'default'
      },
      spec: {
        containers: [
          { image: 'nginx' },
          { image: 'redis' }
        ]
      }
    } as unknown as Unstructured];

    const result = extractPath('[0].spec.containers', items);
    expect(result[0]?.metadata?.name).toBe('test-pod-0');
    expect(result[1]?.metadata?.name).toBe('test-pod-1');
  });

  it('should inherit namespace from parent when not specified', () => {
    const items = [{
      id: 'test-pod',
      metadata: {
        name: 'test-pod',
        namespace: 'custom-ns'
      },
      spec: {
        containers: [
          { name: 'nginx' }
        ]
      }
    } as unknown as Unstructured];

    const result = extractPath('[0].spec.containers', items);
    expect(result[0].metadata?.namespace).toBe('custom-ns');
  });

  it('should use item namespace over parent namespace', () => {
    const items = [{
      id: 'test-pod',
      metadata: {
        name: 'test-pod',
        namespace: 'parent-ns'
      },
      spec: {
        containers: [
          { 
            name: 'nginx',
            metadata: {
              namespace: 'container-ns'
            }
          }
        ]
      }
    } as unknown as Unstructured];

    const result = extractPath('[0].spec.containers', items);
    expect(result[0].metadata?.namespace).toBe('container-ns');
  });
});
