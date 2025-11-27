# DataLoader Technical Documentation

A lightweight batch processing and deduplication utility for optimizing multiple asynchronous data loading requests.

## Table of Contents

- [Introduction](#introduction)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Implementation Details](#implementation-details)
- [Best Practices](#best-practices)
- [Testing](#testing)

## Introduction

DataLoader provides automatic batching, same-batch deduplication, and batch isolation mechanisms to solve the common N+1 query problem. When you need to request the same or different data multiple times in a short period, DataLoader automatically combines these requests into a single batch execution.

### Key Benefits

- ✅ **Batch Processing**: Automatically combines synchronous requests into a single batch
- ✅ **Same-Batch Deduplication**: Requests with identical parameters share the same Promise
- ✅ **Batch Isolation**: Different batches are completely independent, preventing cache pollution
- ✅ **Type Safety**: Complete TypeScript generic support
- ✅ **Zero Dependencies**: Pure TypeScript implementation
- ✅ **Lightweight**: Core implementation in ~60 lines

## Core Concepts

### 1. Batch Processing

DataLoader collects all `load()` calls within the same microtask and processes them as a single batch:

```typescript
const loader = new Dataloader(batchLoadFn);

// These calls are automatically batched
const p1 = loader.load(1);
const p2 = loader.load(2);
const p3 = loader.load(3);

// Results in a single call: batchLoadFn([1, 2, 3])
```

### 2. Same-Batch Deduplication

Within the same batch, identical parameters reuse the same Promise:

```typescript
const p1 = loader.load(1);
const p2 = loader.load(1); // Reuses p1's Promise
const p3 = loader.load(2);

// Actually passes [1, 2] to loaderFn, not [1, 1, 2]
// p1 === p2 (same Promise instance)
```

### 3. Batch Isolation

Cache is completely isolated between different batches:

```typescript
// Batch 1
await loader.load(1); // Cache cleared after completion

// Batch 2 (new batch)
await loader.load(1); // Creates new Promise and new batch
```

## API Reference

### `class Dataloader<T, R>`

Generic parameters:
- `T`: Request parameter type (e.g., `number`, `string`)
- `R`: Return result type (e.g., `User`, `Product`)

#### `constructor(loaderFn)`

Creates a DataLoader instance.

**Parameters:**
- `loaderFn: (args: T[]) => Promise<R[]> | R[]`
  - Batch loading function that accepts an array of parameters and returns an array of results
  - Can be synchronous or asynchronous
  - **Important**: The order of returned results must match the order of input parameters

#### `load(arg: T): Promise<R>`

Loads a single data item.

**Parameters:**
- `arg: T` - The data identifier to load

**Returns:**
- `Promise<R>` - Promise containing the loaded result

**Behavior:**
- Returns cached Promise if same parameter exists in current batch
- Creates new Promise and adds to current batch otherwise
- First call triggers microtask scheduling

## Implementation Details

### Batching Mechanism

DataLoader uses `queueMicrotask` (or `Promise.resolve().then()` as fallback) to implement batching:

```typescript
// First load() call
if (!this.isFlushPending) {
  this.isFlushPending = true;
  queueMicrotask(this.flushJobs); // Schedule batch execution
}

// After current call stack completes, microtask executes
// All load() calls collected are processed at once
```

### Cache Mechanism

Uses `Map<T, Promise<R>>` for same-batch deduplication:

```typescript
// Check cache
if (this.cachePromises.has(arg)) {
  return this.cachePromises.get(arg)!; // Reuse Promise
}

// Create new Promise and cache
const promise = new Promise<R>(...);
this.cachePromises.set(arg, promise);
```

### Batch Isolation

Cache is cleared on each batch execution to ensure batch independence:

```typescript
private flushJobs() {
  // Copy current batch data
  const currentData = this.data.slice();
  const currentResolvers = this.resolveArr.slice();

  // Clear cache and data immediately
  this.cachePromises.clear(); // Key: Clear cache
  this.data.length = 0;
  this.resolveArr.length = 0;

  // Execute batch load
  Promise.resolve(this.loaderFn(currentData)).then(...);
}
```

## Best Practices

### ✅ Recommended Practices

1. **Use Singleton Pattern**

Avoid creating multiple DataLoader instances for the same data type:

```typescript
// ✅ Good: Reuse same instance
const userLoader = new Dataloader(batchLoadUsers);

function useUserData() {
  return userLoader; // Reuse same instance
}

// ❌ Bad: Create new instance each time
function useUserData() {
  return new Dataloader(batchLoadUsers); // New instance each time
}
```

2. **Ensure Correct Return Order**

The order of returned results must match the input parameters:

```typescript
// ✅ Correct: Maintain order
const loader = new Dataloader(async (ids: number[]) => {
  const users = await fetchUsers(ids);
  // Ensure order matches ids
  return ids.map(id => users.find(u => u.id === id));
});

// ❌ Wrong: Order may not match
const loader = new Dataloader(async (ids: number[]) => {
  const users = await fetchUsers(ids);
  return users; // Order might be different from ids
});
```

3. **Proper Error Handling**

Handle errors for individual requests:

```typescript
const results = await Promise.allSettled([
  loader.load(1),
  loader.load(2),
  loader.load(3)
]);

results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`Request ${index + 1} succeeded:`, result.value);
  } else {
    console.error(`Request ${index + 1} failed:`, result.reason);
  }
});
```

### ⚠️ Considerations

1. **Not Suitable for Cross-Batch Caching**

DataLoader only maintains cache within the same batch. For long-term caching needs, consider other solutions.

2. **Batch Size Control**

For potentially large batches, consider chunking in the loaderFn:

```typescript
const loader = new Dataloader(async (ids: number[]) => {
  const chunkSize = 100;
  const results = [];

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const chunkResults = await fetchUsers(chunk);
    results.push(...chunkResults);
  }

  return results;
});
```

## Testing

The project includes comprehensive test coverage with 26 test cases:

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm test:watch
```

### Test Coverage

- ✅ Basic functionality (3 tests)
- ✅ Batching mechanism (3 tests)
- ✅ Same-batch cache deduplication (3 tests)
- ✅ Batch isolation (4 tests)
- ✅ Error handling (3 tests)
- ✅ Async timing (3 tests)
- ✅ Edge cases (6 tests)
- ✅ Fallback mechanism (1 test)

## Performance Considerations

### Advantages

- ✅ Reduces network requests (N requests → 1 request)
- ✅ Lowers server load
- ✅ Improves application response time
- ✅ Efficient memory usage (cache cleared after batch)

### Use Cases

- ✅ Multiple components loading the same type of data
- ✅ List data with related queries (e.g., products with author information)
- ✅ Graph/tree structure data loading
- ✅ GraphQL resolvers
- ✅ Microservice data aggregation

### When Not to Use

- ❌ Real-time data scenarios (batching introduces delay)
- ❌ Long-term caching needs
- ❌ Single large data queries (no batching benefit)

## SSR Considerations

For Server-Side Rendering environments (Next.js, Nuxt.js), avoid module-level singletons to prevent cross-request data pollution:

### ❌ Wrong: Module-level Singleton

```typescript
// This will be shared across all requests in SSR!
let loader: Dataloader<number, User> | null = null;

export function useLoader() {
  if (!loader) {
    loader = new Dataloader(loadUsers);
  }
  return loader; // Dangerous in SSR
}
```

### ✅ Correct: Request-scoped Instance

```typescript
// Create new instance per request
export function createLoader() {
  return new Dataloader(loadUsers);
}

// Or use framework-specific solutions
// Nuxt 3: useState
// Next.js: Context API
```

## References

- [Original Concept: Facebook's DataLoader](https://github.com/graphql/dataloader)
- [Full Documentation (中文)](./README.zh-TW.md)
- [Examples](../examples)
- [Tests](../tests)

## License

MIT

---

**Maintainer**: Tim Lu
**Last Updated**: 2024