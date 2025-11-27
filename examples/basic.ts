/**
 * Basic DataLoader Examples
 *
 * Demonstrates fundamental DataLoader features:
 * - Batch processing
 * - Request deduplication
 * - Error handling
 *
 * Run with: npm run demo:basic
 */

import { Dataloader } from '../src/index';

// Simulated database or API call
async function fetchUsersByIds(ids: number[]) {
  console.log(`📡 Fetching users with IDs: [${ids.join(', ')}]`);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Return mock user data
  return ids.map(id => ({
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
  }));
}

// ====================
// Example 1: Basic Batching
// ====================
async function example1_basicBatching() {
  console.log('\n=== Example 1: Basic Batching ===');

  const userLoader = new Dataloader(fetchUsersByIds);

  console.log('Requesting 3 users separately...');

  // These three calls will be automatically batched
  const [user1, user2, user3] = await Promise.all([
    userLoader.load(1),
    userLoader.load(2),
    userLoader.load(3),
  ]);

  console.log('Results:', { user1, user2, user3 });
  console.log('✅ Notice: Only ONE fetch was made for all 3 users!\n');
}

// ====================
// Example 2: Deduplication
// ====================
async function example2_deduplication() {
  console.log('\n=== Example 2: Deduplication ===');

  const userLoader = new Dataloader(fetchUsersByIds);

  console.log('Requesting user ID 1 three times and user ID 2 twice...');

  // Duplicate requests are automatically deduplicated
  const promises = [
    userLoader.load(1),
    userLoader.load(1),  // Same as first
    userLoader.load(1),  // Same as first
    userLoader.load(2),
    userLoader.load(2),   // Same as fourth
  ];

  const results = await Promise.all(promises);

  console.log('Results:', results);
  console.log('✅ Notice: Only fetched [1, 2], not [1, 1, 1, 2, 2]!\n');

  // Verify that identical requests return the same Promise instance
  const p1 = userLoader.load(5);
  const p2 = userLoader.load(5);
  console.log('Same Promise instance?', p1 === p2); // true
}

// ====================
// Example 3: Batch Isolation
// ====================
async function example3_batchIsolation() {
  console.log('\n=== Example 3: Batch Isolation ===');

  const userLoader = new Dataloader(fetchUsersByIds);

  console.log('First batch:');
  await userLoader.load(1);

  console.log('\nSecond batch (after first completes):');
  await userLoader.load(1);

  console.log('✅ Notice: Same ID fetched twice in different batches!\n');
  console.log('This is by design - DataLoader clears cache between batches.');
}

// ====================
// Example 4: Error Handling
// ====================
async function example4_errorHandling() {
  console.log('\n=== Example 4: Error Handling ===');

  // Loader that throws an error for negative IDs
  const userLoader = new Dataloader(async (ids: number[]) => {
    if (ids.some(id => id < 0)) {
      throw new Error('Invalid ID: negative values not allowed');
    }
    return fetchUsersByIds(ids);
  });

  console.log('Attempting to load valid and invalid IDs...');

  try {
    // All promises in the same batch will fail if one fails
    await Promise.all([
      userLoader.load(1),
      userLoader.load(-1),  // This will cause the batch to fail
      userLoader.load(2),
    ]);
  } catch (error) {
    console.log('❌ Error caught:', (error as Error).message);
  }

  console.log('\nAfter error, new batch with valid IDs:');
  const validUser = await userLoader.load(3);
  console.log('✅ Success:', validUser);
}

// ====================
// Example 5: Different Data Types
// ====================
async function example5_differentTypes() {
  console.log('\n=== Example 5: Different Data Types ===');

  // String keys
  const nameLoader = new Dataloader(async (codes: string[]) => {
    console.log(`📡 Loading country names for: [${codes.join(', ')}]`);
    const countryNames: Record<string, string> = {
      'US': 'United States',
      'UK': 'United Kingdom',
      'JP': 'Japan',
      'CN': 'China',
    };
    return codes.map(code => countryNames[code] || 'Unknown');
  });

  const countries = await Promise.all([
    nameLoader.load('US'),
    nameLoader.load('UK'),
    nameLoader.load('JP'),
  ]);

  console.log('Countries:', countries);
}

// ====================
// Run all examples
// ====================
async function runAllExamples() {
  console.log('🚀 DataLoader Basic Examples\n');
  console.log('=' .repeat(50));

  await example1_basicBatching();
  await example2_deduplication();
  await example3_batchIsolation();
  await example4_errorHandling();
  await example5_differentTypes();

  console.log('\n' + '=' .repeat(50));
  console.log('✅ All examples completed!');
}

// Run if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}