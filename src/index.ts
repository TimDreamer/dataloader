/**
 * DataLoader - 批次處理和去重工具
 *
 * 提供自動批次處理、同批次去重和批次隔離機制，
 * 用於優化多個異步資料載入請求，解決 N+1 查詢問題。
 *
 * @see README.md 完整文件和使用範例
 *
 * @template T - 請求參數類型
 * @template R - 回傳結果類型
 *
 * @example
 * ```typescript
 * // 建立 DataLoader 實例
 * const userLoader = new Dataloader<number, User>(async (userIds) => {
 *   const users = await fetchUsersByIds(userIds);
 *   return users;
 * });
 *
 * // 批次載入（三個請求會合併為一次）
 * const [user1, user2, user3] = await Promise.all([
 *   userLoader.load(1),
 *   userLoader.load(2),
 *   userLoader.load(3),
 * ]);
 * ```
 */
export class Dataloader<T, R> {
  private isFlushPending = false;
  private resolveArr: Array<(value: R) => void> = [];
  private rejectArr: Array<(reason: unknown) => void> = [];
  private data: Array<T> = [];
  private cachePromises = new Map<T, Promise<R>>();

  constructor(private loaderFn: (args: T[]) => Promise<R[]> | R[]) {
    this.flushJobs = this.flushJobs.bind(this);
  }

  load(arg: T) {
    if (this.cachePromises.has(arg)) {
      return this.cachePromises.get(arg)!;
    }

    const promise = new Promise<R>((resolve, reject) => {
      this.resolveArr.push(resolve);
      this.rejectArr.push(reject);
      this.data.push(arg);

      if (!this.isFlushPending) {
        this.isFlushPending = true;
        if ('queueMicrotask' in globalThis) {
          queueMicrotask(this.flushJobs);
        } else {
          Promise.resolve().then(this.flushJobs);
        }
      }
    });

    this.cachePromises.set(arg, promise);
    return promise;
  }

  private flushJobs() {
    if (this.data.length === 0) {
      this.isFlushPending = false;
      return;
    }

    const currentData = this.data.slice();
    const currentResolvers = this.resolveArr.slice();
    const currentRejectors = this.rejectArr.slice();

    this.cachePromises.clear();
    this.rejectArr.length = this.resolveArr.length = this.data.length = 0;
    this.isFlushPending = false;

    Promise.resolve(this.loaderFn(currentData))
      .then((rets) => {
        rets.forEach((ret, index) => {
          currentResolvers[index](ret);
        });
      })
      .catch((err) => {
        currentRejectors.forEach((rej) => rej(err));
      });
  }
}
