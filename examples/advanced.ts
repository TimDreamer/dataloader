/**
 * Advanced DataLoader Examples
 *
 * Demonstrates advanced use cases:
 * - Multiple DataLoader instances
 * - Complex data relationships
 * - Performance optimization
 * - Custom cache strategies
 *
 * Run with: npm run demo:advanced
 */

import { Dataloader } from '../src/index';

// ====================
// Mock Data Types
// ====================
interface User {
  id: number;
  name: string;
  email: string;
  teamId: number;
}

interface Team {
  id: number;
  name: string;
  managerId: number;
}

interface Product {
  id: number;
  name: string;
  price: number;
  authorId: number;
}

interface Review {
  id: number;
  productId: number;
  userId: number;
  rating: number;
  comment: string;
}

// ====================
// Mock Data
// ====================
const USERS_DB: User[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com', teamId: 1 },
  { id: 2, name: 'Bob', email: 'bob@example.com', teamId: 1 },
  { id: 3, name: 'Charlie', email: 'charlie@example.com', teamId: 2 },
  { id: 4, name: 'David', email: 'david@example.com', teamId: 2 },
];

const TEAMS_DB: Team[] = [
  { id: 1, name: 'Engineering', managerId: 1 },
  { id: 2, name: 'Design', managerId: 3 },
];

const PRODUCTS_DB: Product[] = [
  { id: 101, name: 'TypeScript Course', price: 99, authorId: 1 },
  { id: 102, name: 'React Workshop', price: 149, authorId: 2 },
  { id: 103, name: 'Node.js Guide', price: 79, authorId: 1 },
];

const REVIEWS_DB: Review[] = [
  { id: 1, productId: 101, userId: 2, rating: 5, comment: 'Excellent!' },
  { id: 2, productId: 101, userId: 3, rating: 4, comment: 'Very good' },
  { id: 3, productId: 102, userId: 1, rating: 5, comment: 'Amazing workshop' },
  { id: 4, productId: 103, userId: 4, rating: 4, comment: 'Helpful guide' },
];

// ====================
// Mock API Functions
// ====================
async function fetchUsers(ids: number[]): Promise<(User | undefined)[]> {
  console.log(`  📡 Fetching users: [${ids.join(', ')}]`);
  await new Promise(r => setTimeout(r, 50));
  return ids.map(id => USERS_DB.find(u => u.id === id));
}

async function fetchTeams(ids: number[]): Promise<(Team | undefined)[]> {
  console.log(`  📡 Fetching teams: [${ids.join(', ')}]`);
  await new Promise(r => setTimeout(r, 50));
  return ids.map(id => TEAMS_DB.find(t => t.id === id));
}

async function fetchProducts(ids: number[]): Promise<(Product | undefined)[]> {
  console.log(`  📡 Fetching products: [${ids.join(', ')}]`);
  await new Promise(r => setTimeout(r, 50));
  return ids.map(id => PRODUCTS_DB.find(p => p.id === id));
}

async function fetchReviewsByProduct(productIds: number[]): Promise<Review[][]> {
  console.log(`  📡 Fetching reviews for products: [${productIds.join(', ')}]`);
  await new Promise(r => setTimeout(r, 50));
  return productIds.map(pid =>
    REVIEWS_DB.filter(r => r.productId === pid)
  );
}

// ====================
// Example 1: Multiple Loaders Working Together
// ====================
async function example1_multipleLoaders() {
  console.log('\n=== Example 1: Multiple DataLoaders ===');
  console.log('Scenario: Loading product details with author and reviews\n');

  const userLoader = new Dataloader(fetchUsers);
  const productLoader = new Dataloader(fetchProducts);
  const reviewLoader = new Dataloader(fetchReviewsByProduct);

  // Simulate loading multiple products with their related data
  async function loadProductWithDetails(productId: number) {
    const product = await productLoader.load(productId);
    if (!product) return null;

    const [author, reviews] = await Promise.all([
      userLoader.load(product.authorId),
      reviewLoader.load(productId),
    ]);

    return { ...product, author, reviews };
  }

  console.log('Loading 3 products with details...');
  const products = await Promise.all([
    loadProductWithDetails(101),
    loadProductWithDetails(102),
    loadProductWithDetails(103),
  ]);

  console.log('\nResults:');
  products.forEach(p => {
    if (p) {
      console.log(`- ${p.name} by ${p.author?.name} (${p.reviews.length} reviews)`);
    }
  });

  console.log('\n✅ Notice: Efficient batching across multiple data types!');
}

// ====================
// Example 2: Hierarchical Data Loading
// ====================
async function example2_hierarchicalData() {
  console.log('\n=== Example 2: Hierarchical Data Loading ===');
  console.log('Scenario: Loading users with their teams and team managers\n');

  const userLoader = new Dataloader(fetchUsers);
  const teamLoader = new Dataloader(fetchTeams);

  async function loadUserHierarchy(userId: number) {
    const user = await userLoader.load(userId);
    if (!user) return null;

    const team = await teamLoader.load(user.teamId);
    if (!team) return { ...user, team: null, manager: null };

    const manager = await userLoader.load(team.managerId);

    return {
      ...user,
      team,
      manager,
    };
  }

  console.log('Loading user hierarchies...');
  const hierarchies = await Promise.all(
    [1, 2, 3, 4].map(id => loadUserHierarchy(id))
  );

  console.log('\nResults:');
  hierarchies.forEach(h => {
    if (h) {
      console.log(`- ${h.name} → Team: ${h.team?.name} → Manager: ${h.manager?.name}`);
    }
  });

  console.log('\n✅ Notice: Automatic deduplication of manager requests!');
}

// ====================
// Example 3: Performance Measurement
// ====================
async function example3_performanceComparison() {
  console.log('\n=== Example 3: Performance Comparison ===');
  console.log('Comparing with and without DataLoader\n');

  // Without DataLoader - direct calls
  console.log('Without DataLoader:');
  const startWithout = Date.now();

  const directResults = [];
  for (const id of [1, 1, 2, 2, 3, 3]) {
    const users = await fetchUsers([id]);
    directResults.push(users[0]);
  }

  const timeWithout = Date.now() - startWithout;
  console.log(`  Time: ${timeWithout}ms (6 separate API calls)`);

  // With DataLoader
  console.log('\nWith DataLoader:');
  const startWith = Date.now();

  const userLoader = new Dataloader(fetchUsers);
  const loaderResults = await Promise.all(
    [1, 1, 2, 2, 3, 3].map(id => userLoader.load(id))
  );

  const timeWith = Date.now() - startWith;
  console.log(`  Time: ${timeWith}ms (1 batched API call)`);

  const improvement = Math.round((1 - timeWith / timeWithout) * 100);
  console.log(`\n✅ Performance improvement: ~${improvement}% faster!`);
}

// ====================
// Example 4: Complex Query Optimization
// ====================
async function example4_complexQueries() {
  console.log('\n=== Example 4: Complex Query Optimization ===');
  console.log('Scenario: Dashboard loading multiple data types\n');

  // Create all loaders
  const loaders = {
    user: new Dataloader(fetchUsers),
    team: new Dataloader(fetchTeams),
    product: new Dataloader(fetchProducts),
    review: new Dataloader(fetchReviewsByProduct),
  };

  // Simulate a dashboard that needs various data
  async function loadDashboard() {
    console.log('Loading dashboard data...');

    // All these requests will be efficiently batched
    const [
      currentUser,
      teamMembers,
      recentProducts,
      productReviews,
    ] = await Promise.all([
      loaders.user.load(1),
      Promise.all([2, 3, 4].map(id => loaders.user.load(id))),
      Promise.all([101, 102, 103].map(id => loaders.product.load(id))),
      Promise.all([101, 102].map(id => loaders.review.load(id))),
    ]);

    return {
      currentUser,
      teamMembers,
      recentProducts,
      totalReviews: productReviews.flat().length,
    };
  }

  const dashboard = await loadDashboard();

  console.log('\nDashboard loaded:');
  console.log(`- Current user: ${dashboard.currentUser?.name}`);
  console.log(`- Team members: ${dashboard.teamMembers.length}`);
  console.log(`- Recent products: ${dashboard.recentProducts.length}`);
  console.log(`- Total reviews: ${dashboard.totalReviews}`);

  console.log('\n✅ Complex dashboard loaded with minimal API calls!');
}

// ====================
// Example 5: Handling Large Batches
// ====================
async function example5_largeBatches() {
  console.log('\n=== Example 5: Handling Large Batches ===');
  console.log('Scenario: Loading data for 100 items\n');

  let apiCallCount = 0;

  // Loader with batch size tracking
  const trackedLoader = new Dataloader(async (ids: number[]) => {
    apiCallCount++;
    console.log(`  📡 API call #${apiCallCount}: Batch size = ${ids.length}`);

    // Simulate API call
    await new Promise(r => setTimeout(r, 20));

    return ids.map(id => ({
      id,
      value: `Item ${id}`,
      timestamp: Date.now(),
    }));
  });

  console.log('Requesting 100 items...');

  // Create 100 requests
  const promises = Array.from({ length: 100 }, (_, i) =>
    trackedLoader.load(i + 1)
  );

  const results = await Promise.all(promises);

  console.log(`\n✅ Loaded ${results.length} items in just ${apiCallCount} API call!`);
  console.log('   Without DataLoader: 100 API calls');
  console.log('   With DataLoader: 1 API call');
  console.log('   Efficiency gain: 99% fewer API calls!');
}

// ====================
// Run all examples
// ====================
async function runAllExamples() {
  console.log('🚀 DataLoader Advanced Examples\n');
  console.log('=' .repeat(50));

  await example1_multipleLoaders();
  await example2_hierarchicalData();
  await example3_performanceComparison();
  await example4_complexQueries();
  await example5_largeBatches();

  console.log('\n' + '=' .repeat(50));
  console.log('✅ All advanced examples completed!');
  console.log('\n💡 Key takeaways:');
  console.log('   - Use multiple DataLoaders for different data types');
  console.log('   - DataLoader automatically optimizes complex queries');
  console.log('   - Significant performance gains with minimal code changes');
  console.log('   - Perfect for GraphQL resolvers, REST APIs, and more!');
}

// Run if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}