中文 | [English](./README.md)

# @timdreamer/dataloader

輕量級、框架無關的批次處理和去重工具，用於優化 JavaScript/TypeScript 應用程式中的非同步資料載入。

[![npm version](https://img.shields.io/npm/v/@timdreamer/dataloader.svg)](https://www.npmjs.com/package/@timdreamer/dataloader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 功能特色

- ✅ **自動批次處理** - 將多個請求合併為單一批次操作
- ✅ **請求去重** - 同一批次中相同的請求共享同一個 Promise
- ✅ **批次隔離** - 每個批次完全獨立，防止快取污染
- ✅ **零依賴** - 純 TypeScript 實作，無外部依賴
- ✅ **框架無關** - 可在任何 JavaScript/TypeScript 環境中使用
- ✅ **型別安全** - 完整的 TypeScript 支援與泛型
- ✅ **輕量級** - 核心實作僅約 60 行程式碼

## 安裝

```bash
npm install @timdreamer/dataloader
```

```bash
yarn add @timdreamer/dataloader
```

```bash
pnpm add @timdreamer/dataloader
```

## 快速開始

```typescript
import { Dataloader } from '@timdreamer/dataloader';

// 定義批次載入函式
const batchLoadUsers = async (userIds: number[]) => {
  // 在一次 API 呼叫中取得多個使用者
  const users = await fetch('/api/users/batch', {
    method: 'POST',
    body: JSON.stringify({ ids: userIds })
  }).then(res => res.json());

  // 以相同的順序回傳結果
  return userIds.map(id => users.find(u => u.id === id));
};

// 建立 DataLoader 實例
const userLoader = new Dataloader(batchLoadUsers);

// 載入資料 - 多次呼叫會自動批次處理
const user1 = await userLoader.load(1);
const user2 = await userLoader.load(2);
const user3 = await userLoader.load(3);
```

## 框架整合範例

### React

```typescript
// hooks/useDataLoader.ts
import { useMemo } from 'react';
import { Dataloader } from '@timdreamer/dataloader';

export function useUserLoader() {
  const loader = useMemo(
    () => new Dataloader<number, User>(async (userIds) => {
      const response = await fetch('/api/users/batch', {
        method: 'POST',
        body: JSON.stringify({ ids: userIds }),
      });
      return response.json();
    }),
    []
  );

  return loader;
}

// components/UserProfile.tsx
function UserProfile({ userId }: { userId: number }) {
  const userLoader = useUserLoader();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    userLoader.load(userId).then(setUser);
  }, [userId]);

  return user ? <div>{user.name}</div> : <div>載入中...</div>;
}
```

### Vue 3

```typescript
// composables/useDataLoader.ts
import { Dataloader } from '@timdreamer/dataloader';

export function useUserLoader() {
  const loader = new Dataloader<number, User>(async (userIds) => {
    const response = await fetch('/api/users/batch', {
      method: 'POST',
      body: JSON.stringify({ ids: userIds }),
    });
    return response.json();
  });

  return {
    loadUser: (id: number) => loader.load(id),
  };
}

// components/UserProfile.vue
<script setup lang="ts">
const props = defineProps<{ userId: number }>();
const { loadUser } = useUserLoader();
const user = ref<User | null>(null);

onMounted(async () => {
  user.value = await loadUser(props.userId);
});
</script>
```

### Next.js / Nuxt.js (SSR)

⚠️ **重要**：在 SSR 環境中，避免使用模組層級的單例模式，以防止跨請求資料污染。

```typescript
// Nuxt 3 - composables/useDataLoader.ts
import { Dataloader } from '@timdreamer/dataloader';

export function useUserLoader() {
  // useState 確保 SSR 中的請求隔離
  const loader = useState(
    'userLoader',
    () => new Dataloader<number, User>(async (userIds) => {
      const response = await $fetch('/api/users/batch', {
        method: 'POST',
        body: { ids: userIds },
      });
      return response;
    })
  );

  return {
    loadUser: (id: number) => loader.value.load(id),
  };
}
```

### Node.js / Express

```typescript
// middleware/dataloader.ts
import { Dataloader } from '@timdreamer/dataloader';

// 為每個請求建立新的 DataLoader 實例
export function createLoaders() {
  return {
    userLoader: new Dataloader(async (userIds: number[]) => {
      const users = await db.users.findMany({
        where: { id: { in: userIds } },
      });
      return userIds.map(id => users.find(u => u.id === id));
    }),
  };
}

// 附加到請求上下文
app.use((req, res, next) => {
  req.loaders = createLoaders();
  next();
});
```

## API

### `new Dataloader<T, R>(loaderFn)`

建立新的 DataLoader 實例。

- **`loaderFn`**: `(args: T[]) => Promise<R[]> | R[]`
  接受鍵值陣列並回傳值陣列（或 Promise）的函式。
  回傳的陣列必須與輸入陣列具有相同的長度和順序。

### `loader.load(key: T): Promise<R>`

載入單一值。同一批次中的多次呼叫會自動批次處理。

## 實際應用案例

```typescript
// 多個元件請求相同的資料
function ProductCard({ productId }: { productId: number }) {
  const product = await productLoader.load(productId);
  // ...
}

function ProductPrice({ productId }: { productId: number }) {
  const product = await productLoader.load(productId);
  // ...
}

function ProductReviews({ productId }: { productId: number }) {
  const product = await productLoader.load(productId);
  // ...
}

// 三個元件都請求 productId: 123
// DataLoader 自動：
// 1. 將所有請求批次為單一 API 呼叫
// 2. 去重複的 productId
// 3. 回傳相同結果給三個元件
```

## 文件

- 📚 [完整技術文件（中文）](./docs/README.zh-TW.md)
- 📚 [完整技術文件（English）](./docs/README.en.md)
- 💻 [範例程式碼](./examples)
- 🧪 [測試](./tests)

## 執行範例

執行範例程式：

```bash
# 基礎範例
npm run demo:basic

# 進階範例
npm run demo:advanced
```

## 貢獻

歡迎貢獻！請隨時提交 Pull Request。

## 授權

MIT © [TimDreamer](https://github.com/TimDreamer)

## 致謝

受 [Facebook 的 DataLoader](https://github.com/graphql/dataloader) 概念啟發，重新實作為輕量級、零依賴的解決方案。