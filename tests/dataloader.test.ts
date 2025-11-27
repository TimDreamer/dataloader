import { describe, it, expect, vi } from 'vitest';

import { Dataloader } from '../src/index';

describe('Dataloader', () => {
  describe('基礎功能', () => {
    it('應該正確載入單個值', async () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);
      const result = await loader.load(1);

      expect(result).toBe(10);
      expect(batchLoadFn).toHaveBeenCalledTimes(1);
      expect(batchLoadFn).toHaveBeenCalledWith([1]);
    });

    it('應該回傳 Promise', () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);
      const result = loader.load(1);

      expect(result).toBeInstanceOf(Promise);
    });

    it('應該支援同步的 loaderFn', async () => {
      const batchLoadFn = vi.fn((keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);
      const result = await loader.load(1);

      expect(result).toBe(10);
    });
  });

  describe('批次處理（Batching）', () => {
    it('應該將多個 load 呼叫合併為單次 loaderFn 呼叫', async () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);

      const p1 = loader.load(1);
      const p2 = loader.load(2);
      const p3 = loader.load(3);

      const results = await Promise.all([p1, p2, p3]);

      expect(results).toEqual([10, 20, 30]);
      expect(batchLoadFn).toHaveBeenCalledTimes(1);
      expect(batchLoadFn).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('應該在 microtask 佇列中批次處理', async () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);
      const callOrder: string[] = [];

      callOrder.push('sync-1');
      loader.load(1);

      callOrder.push('sync-2');
      loader.load(2);

      callOrder.push('sync-3');

      await Promise.resolve().then(() => {
        callOrder.push('microtask');
      });

      // loaderFn 應該在 microtask 中被呼叫
      expect(batchLoadFn).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(['sync-1', 'sync-2', 'sync-3', 'microtask']);
    });

    it('應該支援多個獨立的批次', async () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);

      // 第一批
      const p1 = loader.load(1);
      const p2 = loader.load(2);
      await Promise.all([p1, p2]);

      // 第二批
      const p3 = loader.load(3);
      const p4 = loader.load(4);
      await Promise.all([p3, p4]);

      expect(batchLoadFn).toHaveBeenCalledTimes(2);
      expect(batchLoadFn).toHaveBeenNthCalledWith(1, [1, 2]);
      expect(batchLoadFn).toHaveBeenNthCalledWith(2, [3, 4]);
    });
  });

  describe('同批次快取去重', () => {
    it('同批次內相同參數應該回傳同一個 Promise', () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);

      const p1 = loader.load(1);
      const p2 = loader.load(1);
      const p3 = loader.load(2);

      expect(p1).toBe(p2); // 同一個 Promise
      expect(p1).not.toBe(p3); // 不同 Promise
    });

    it('應該對重複的 key 去重（只呼叫一次 loaderFn）', async () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);

      const p1 = loader.load(1);
      const p2 = loader.load(1);
      const p3 = loader.load(1);
      const p4 = loader.load(2);

      const results = await Promise.all([p1, p2, p3, p4]);

      expect(results).toEqual([10, 10, 10, 20]);
      expect(batchLoadFn).toHaveBeenCalledTimes(1);
      // 應該只傳遞唯一值 [1, 2]
      expect(batchLoadFn).toHaveBeenCalledWith([1, 2]);
    });

    it('同批次內所有相同 key 的 Promise 都應該 resolve 到相同值', async () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);

      const promises = [
        loader.load(1),
        loader.load(2),
        loader.load(1),
        loader.load(3),
        loader.load(2),
      ];

      const results = await Promise.all(promises);

      expect(results[0]).toBe(10);
      expect(results[2]).toBe(10); // 相同 key
      expect(results[1]).toBe(20);
      expect(results[4]).toBe(20); // 相同 key
      expect(results[3]).toBe(30);
    });
  });

  describe('批次隔離（Cache Clearing）', () => {
    it('不同批次的相同參數應該建立新的 Promise', async () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);

      // 第一批
      const p1 = loader.load(1);
      await p1;

      // 第二批（批次完成後）
      const p2 = loader.load(1);
      await p2; // ✅ 等待第二批完成

      expect(p1).not.toBe(p2); // 不同 Promise
      expect(batchLoadFn).toHaveBeenCalledTimes(2);
    });

    it('批次完成後快取應該被清空', async () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);

      // 第一批
      await loader.load(1);

      // 檢查快取已清空（透過重新請求相同 key 驗證）
      await loader.load(1);

      expect(batchLoadFn).toHaveBeenCalledTimes(2);
      expect(batchLoadFn).toHaveBeenNthCalledWith(1, [1]);
      expect(batchLoadFn).toHaveBeenNthCalledWith(2, [1]);
    });

    it('批次執行期間的新請求應該建立新批次', async () => {
      let resolveLoaderFn: ((value: number[]) => void) | undefined;
      const batchLoadFn = vi.fn(
        () =>
          new Promise<number[]>((resolve) => {
            resolveLoaderFn = resolve;
          }),
      );

      const loader = new Dataloader(batchLoadFn);

      // 啟動第一批
      const p1 = loader.load(1);
      const p2 = loader.load(2);

      // 等待 microtask，確保第一批已開始執行
      await Promise.resolve();

      // 在第一批執行期間，發起新請求
      loader.load(3);

      // 完成第一批
      resolveLoaderFn!([10, 20]);
      await Promise.all([p1, p2]);

      // 第三個請求應該在新批次中
      expect(batchLoadFn).toHaveBeenCalledTimes(2);
      expect(batchLoadFn).toHaveBeenNthCalledWith(1, [1, 2]);
      expect(batchLoadFn).toHaveBeenNthCalledWith(2, [3]);
    });

    it('批次執行時新請求應該等待下一個批次', async () => {
      const delays: Array<() => void> = [];
      const batchLoadFn = vi.fn((keys: number[]) => {
        return new Promise<number[]>((resolve) => {
          delays.push(() => resolve(keys.map((k) => k * 10)));
        });
      });

      const loader = new Dataloader(batchLoadFn);

      // 啟動批次 1
      const p1 = loader.load(1);
      await Promise.resolve();

      // 啟動批次 2（在批次 1 完成前）
      const p2 = loader.load(2);
      await Promise.resolve();

      // 完成批次 1
      delays[0]();
      await p1;

      // 完成批次 2
      delays[1]();
      const result2 = await p2;

      expect(result2).toBe(20);
      expect(batchLoadFn).toHaveBeenCalledTimes(2); // 批次 1, 批次 2
      expect(batchLoadFn).toHaveBeenNthCalledWith(1, [1]);
      expect(batchLoadFn).toHaveBeenNthCalledWith(2, [2]);
    });
  });

  describe('錯誤處理', () => {
    it('loaderFn 拋出錯誤時，所有 Promise 都應該 reject', async () => {
      const error = new Error('Batch load failed');
      const batchLoadFn = vi.fn(async () => {
        throw error;
      });

      const loader = new Dataloader(batchLoadFn);

      const p1 = loader.load(1);
      const p2 = loader.load(2);

      await expect(p1).rejects.toThrow('Batch load failed');
      await expect(p2).rejects.toThrow('Batch load failed');
    });

    it('同批次內所有相同 key 的 Promise 都應該 reject', async () => {
      const error = new Error('Batch load failed');
      const batchLoadFn = vi.fn(async () => {
        throw error;
      });

      const loader = new Dataloader(batchLoadFn);

      const p1 = loader.load(1);
      const p2 = loader.load(1);
      const p3 = loader.load(2);

      await expect(p1).rejects.toThrow('Batch load failed');
      await expect(p2).rejects.toThrow('Batch load failed');
      await expect(p3).rejects.toThrow('Batch load failed');

      // 應該是同一個 Promise
      expect(p1).toBe(p2);
    });

    it('錯誤不應該影響後續批次', async () => {
      let shouldFail = true;
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        if (shouldFail) {
          throw new Error('First batch failed');
        }
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);

      // 第一批失敗
      const p1 = loader.load(1);
      await expect(p1).rejects.toThrow('First batch failed');

      // 第二批成功
      shouldFail = false;
      const p2 = loader.load(2);
      const result = await p2;

      expect(result).toBe(20);
      expect(batchLoadFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('非同步時序', () => {
    it('應該在下一個 microtask 中執行 loaderFn', async () => {
      const executionOrder: string[] = [];
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        executionOrder.push('loaderFn');
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);

      executionOrder.push('load-1');
      loader.load(1);

      executionOrder.push('load-2');
      loader.load(2);

      executionOrder.push('sync-end');

      // 等待 microtask
      await Promise.resolve();

      expect(executionOrder).toEqual(['load-1', 'load-2', 'sync-end', 'loaderFn']);
    });

    it('快速連續的 load 呼叫應該在同一批次', async () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);

      // 同步連續呼叫
      for (let i = 1; i <= 10; i++) {
        loader.load(i);
      }

      // 等待所有完成
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 應該只有一次批次呼叫
      expect(batchLoadFn).toHaveBeenCalledTimes(1);
      expect(batchLoadFn).toHaveBeenCalledWith([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('不同事件循環的 load 呼叫應該在不同批次', async () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);

      // 第一個事件循環
      loader.load(1);
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 第二個事件循環
      loader.load(2);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(batchLoadFn).toHaveBeenCalledTimes(2);
      expect(batchLoadFn).toHaveBeenNthCalledWith(1, [1]);
      expect(batchLoadFn).toHaveBeenNthCalledWith(2, [2]);
    });
  });

  describe('邊界情況', () => {
    it('應該處理空批次（不應該發生）', () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      new Dataloader(batchLoadFn);

      // 不呼叫 load，直接觸發 microtask
      // 這種情況下 flushJobs 應該提前返回

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(batchLoadFn).not.toHaveBeenCalled();
          resolve();
        }, 10);
      });
    });

    it('應該支援不同類型的 key', async () => {
      const batchLoadFn = vi.fn(async (keys: string[]) => {
        return keys.map((key) => `result-${key}`);
      });

      const loader = new Dataloader(batchLoadFn);

      const results = await Promise.all([loader.load('a'), loader.load('b'), loader.load('c')]);

      expect(results).toEqual(['result-a', 'result-b', 'result-c']);
    });

    it('應該支援物件類型的值', async () => {
      interface User {
        id: number;
        name: string;
      }

      const batchLoadFn = vi.fn(async (ids: number[]): Promise<User[]> => {
        return ids.map((id) => ({ id, name: `User ${id}` }));
      });

      const loader = new Dataloader<number, User>(batchLoadFn);

      const users = await Promise.all([loader.load(1), loader.load(2)]);

      expect(users).toEqual([
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
      ]);
    });

    it('應該支援 loaderFn 回傳 Promise 或直接值', async () => {
      // 測試同步回傳
      const syncLoader = new Dataloader((keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const result1 = await syncLoader.load(1);
      expect(result1).toBe(10);

      // 測試非同步回傳
      const asyncLoader = new Dataloader(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const result2 = await asyncLoader.load(2);
      expect(result2).toBe(20);
    });

    it('連續多次批次應該正常運作', async () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);

      // 執行 5 個批次
      for (let i = 0; i < 5; i++) {
        const result = await loader.load(i + 1);
        expect(result).toBe((i + 1) * 10);
      }

      expect(batchLoadFn).toHaveBeenCalledTimes(5);
    });

    it('大量請求應該正確處理', async () => {
      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);

      // 同時發起 100 個請求
      const promises: Promise<number>[] = [];
      for (let i = 1; i <= 100; i++) {
        promises.push(loader.load(i));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      expect(results[0]).toBe(10);
      expect(results[99]).toBe(1000);
      expect(batchLoadFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('queueMicrotask fallback', () => {
    it('應該在不支援 queueMicrotask 時使用 Promise.resolve', async () => {
      // 儲存原始的 queueMicrotask
      const originalQueueMicrotask = globalThis.queueMicrotask;

      // 模擬不支援 queueMicrotask 的環境
      // @ts-expect-error - 測試 fallback
      delete globalThis.queueMicrotask;

      const batchLoadFn = vi.fn(async (keys: number[]) => {
        return keys.map((key) => key * 10);
      });

      const loader = new Dataloader(batchLoadFn);

      const result = await loader.load(1);

      expect(result).toBe(10);
      expect(batchLoadFn).toHaveBeenCalledTimes(1);

      // 恢復 queueMicrotask
      globalThis.queueMicrotask = originalQueueMicrotask;
    });
  });
});
