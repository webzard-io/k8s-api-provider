// TODO(xingyu) mock k8s client
import { KubeApi, UnstructuredList, WatchEvent, StopWatchHandler } from '../src/kube-api';

export class MockKubeApi<T extends UnstructuredList = UnstructuredList> extends KubeApi<T> {
  private mockData: T;
  private mockEvents: WatchEvent[] = [];
  private mockError: Error | null = null;
  private mockStopHandler: StopWatchHandler = () => {};

  constructor(options: any) {
    super(options);
  }

  setMockData(data: T): void {
    this.mockData = data;
  }

  setMockEvents(events: WatchEvent[]): void {
    this.mockEvents = events;
  }

  setMockError(error: Error): void {
    this.mockError = error;
  }

  setMockStopHandler(handler: StopWatchHandler): void {
    this.mockStopHandler = handler;
  }

  async list(): Promise<T> {
    if (this.mockError) {
      return Promise.reject(this.mockError);
    }
    return Promise.resolve(this.mockData);
  }

  async listWatch({
    onResponse,
    onEvent,
    signal,
  }: {
    onResponse?: (response: T, event?: WatchEvent) => void;
    onEvent?: (event: WatchEvent) => void;
    signal?: AbortSignal;
  } = {}): Promise<StopWatchHandler> {
    if (this.mockError) {
      return Promise.reject(this.mockError);
    }

    // Simulate initial response
    if (onResponse) {
      onResponse(this.mockData);
    }

    // Simulate events
    if (this.mockEvents.length > 0) {
      setTimeout(() => {
        this.mockEvents.forEach(event => {
          if (signal?.aborted) return;
          
          if (onEvent) {
            onEvent(event);
          }
          
          if (onResponse) {
            onResponse(this.mockData, event);
          }
        });
      }, 10);
    }

    return Promise.resolve(this.mockStopHandler);
  }

  resetRetryState(): void {
    // Mock implementation
  }
}

export function createMockKubeApiFactory() {
  return jest.fn().mockImplementation((options: any) => {
    return new MockKubeApi(options);
  });
}
