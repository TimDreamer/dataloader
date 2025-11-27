[中文](./README.zh-TW.md) | English

# @timdreamer/dataloader

A lightweight, framework-agnostic batch processing and deduplication utility for optimizing asynchronous data loading in JavaScript/TypeScript applications.

[![npm version](https://img.shields.io/npm/v/@timdreamer/dataloader.svg)](https://www.npmjs.com/package/@timdreamer/dataloader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- ✅ **Automatic Batching** - Combines multiple requests into a single batch operation
- ✅ **Request Deduplication** - Identical requests within the same batch share the same Promise
- ✅ **Batch Isolation** - Each batch is completely independent, preventing cache pollution
- ✅ **Zero Dependencies** - Pure TypeScript implementation with no external dependencies
- ✅ **Framework Agnostic** - Works with any JavaScript/TypeScript environment
- ✅ **Type Safe** - Full TypeScript support with generics
- ✅ **Lightweight** - Core implementation in just ~60 lines of code

## Installation

```bash
npm install @timdreamer/dataloader
```

```bash
yarn add @timdreamer/dataloader
```

```bash
pnpm add @timdreamer/dataloader
```

## Quick Start

```typescript
import { Dataloader } from '@timdreamer/dataloader';

// Define a batch loading function
const batchLoadUsers = async (userIds: number[]) => {
  // Fetch multiple users in one API call
  const users = await fetch('/api/users/batch', {
    method: 'POST',
    body: JSON.stringify({ ids: userIds })
  }).then(res => res.json());

  // Return results in the same order as input
  return userIds.map(id => users.find(u => u.id === id));
};

// Create a DataLoader instance
const userLoader = new Dataloader(batchLoadUsers);

// Load data - multiple calls will be automatically batched
const user1 = await userLoader.load(1);
const user2 = await userLoader.load(2);
const user3 = await userLoader.load(3);
```

## Framework Integration Examples

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

  return user ? <div>{user.name}</div> : <div>Loading...</div>;
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

⚠️ **Important**: For SSR environments, avoid module-level singletons to prevent cross-request data pollution.

```typescript
// Nuxt 3 - composables/useDataLoader.ts
import { Dataloader } from '@timdreamer/dataloader';

export function useUserLoader() {
  // useState ensures request isolation in SSR
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

// Create a new DataLoader instance per request
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

// Attach to request context
app.use((req, res, next) => {
  req.loaders = createLoaders();
  next();
});
```

## API

### `new Dataloader<T, R>(loaderFn)`

Creates a new DataLoader instance.

- **`loaderFn`**: `(args: T[]) => Promise<R[]> | R[]`
  A function that accepts an array of keys and returns an array of values (or a Promise).
  The returned array must have the same length and order as the input array.

### `loader.load(key: T): Promise<R>`

Loads a single value. Multiple calls within the same batch will be automatically batched together.

## Real-World Use Case

```typescript
// Multiple components requesting the same data
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

// All three components request productId: 123
// DataLoader automatically:
// 1. Batches all requests into a single API call
// 2. Deduplicates the repeated productId
// 3. Returns the same result to all three components
```

## Documentation

- 📚 [Full Technical Documentation (中文)](./docs/README.zh-TW.md)
- 📚 [Full Technical Documentation (English)](./docs/README.en.md)
- 💻 [Examples](./examples)
- 🧪 [Tests](./tests)

## Examples

Run the examples:

```bash
# Basic example
npm run demo:basic

# Advanced example
npm run demo:advanced
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [TimDreamer](https://github.com/TimDreamer)

## Credits

Inspired by [Facebook's DataLoader](https://github.com/graphql/dataloader) concept, reimplemented as a lightweight, zero-dependency solution.