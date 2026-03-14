---
name: ecc-coding-standards
description: Universal coding standards for TypeScript, JavaScript, React, and Node.js. Use when starting projects, reviewing code quality, refactoring for conventions, or enforcing naming, formatting, and structural consistency. Covers React patterns, file organization, performance (memoization, lazy loading), and JSDoc standards.
---

# Coding Standards & Best Practices

Universal coding standards applicable across all projects.

## When to Activate

- Starting a new project or module
- Reviewing code for quality and maintainability
- Refactoring existing code to follow conventions
- Enforcing naming, formatting, or structural consistency
- Setting up linting, formatting, or type-checking rules
- Onboarding new contributors to coding conventions

## Code Quality Principles

### 1. Readability First
- Code is read more than written
- Clear variable and function names
- Self-documenting code preferred over comments
- Consistent formatting

### 2. KISS (Keep It Simple, Stupid)
- Simplest solution that works
- Avoid over-engineering
- No premature optimization

### 3. DRY (Don't Repeat Yourself)
- Extract common logic into functions
- Create reusable components
- Share utilities across modules

### 4. YAGNI (You Aren't Gonna Need It)
- Don't build features before they're needed
- Start simple, refactor when needed

## TypeScript/JavaScript Standards

### Variable Naming
```typescript
// ✅ GOOD: Descriptive names
const marketSearchQuery = 'election'
const isUserAuthenticated = true
const totalRevenue = 1000

// ❌ BAD: Unclear names
const q = 'election'
const flag = true
const x = 1000
```

### Function Naming
```typescript
// ✅ GOOD: Verb-noun pattern
async function fetchMarketData(marketId: string) { }
function calculateSimilarity(a: number[], b: number[]) { }
function isValidEmail(email: string): boolean { }

// ❌ BAD: Unclear or noun-only
async function market(id: string) { }
function similarity(a, b) { }
```

### Immutability Pattern (CRITICAL)
```typescript
// ✅ ALWAYS use spread operator
const updatedUser = { ...user, name: 'New Name' }
const updatedArray = [...items, newItem]

// ❌ NEVER mutate directly
user.name = 'New Name'
items.push(newItem)
```

### Error Handling
```typescript
// ✅ GOOD: Comprehensive error handling
async function fetchData(url: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Fetch failed:', error)
    throw new Error('Failed to fetch data')
  }
}
```

### Async/Await Best Practices
```typescript
// ✅ GOOD: Parallel execution when possible
const [users, markets, stats] = await Promise.all([
  fetchUsers(),
  fetchMarkets(),
  fetchStats()
])

// ❌ BAD: Sequential when unnecessary
const users = await fetchUsers()
const markets = await fetchMarkets()
const stats = await fetchStats()
```

### Type Safety
```typescript
// ✅ GOOD: Proper types
interface Market {
  id: string
  name: string
  status: 'active' | 'resolved' | 'closed'
  created_at: Date
}

// ❌ BAD: Using 'any'
function getMarket(id: any): Promise<any> { }
```

## React Best Practices

### Component Structure
```typescript
interface ButtonProps {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}

export function Button({
  children,
  onClick,
  disabled = false,
  variant = 'primary'
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
    >
      {children}
    </button>
  )
}
```

### Custom Hooks
```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}
```

### State Management
```typescript
// ✅ GOOD: Functional update for state based on previous state
setCount(prev => prev + 1)

// ❌ BAD: Direct state reference (can be stale in async)
setCount(count + 1)
```

### Conditional Rendering
```typescript
// ✅ GOOD: Clear conditional rendering
{isLoading && <LoadingSpinner />}
{error && <ErrorMessage error={error} />}
{data && <DataDisplay data={data} />}

// ❌ BAD: Ternary hell
{isLoading ? <Loading /> : error ? <Error /> : data ? <Data /> : null}
```

## File Organization

### Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes
│   ├── markets/            # Feature pages
│   └── (auth)/             # Auth pages (route groups)
├── components/             # React components
│   ├── ui/                 # Generic UI components
│   ├── forms/              # Form components
│   └── layouts/            # Layout components
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and configs
│   ├── api/                # API clients
│   ├── utils/              # Helper functions
│   └── constants/          # Constants
├── types/                  # TypeScript types
└── styles/                 # Global styles
```

### File Naming
```
components/Button.tsx       # PascalCase for components
hooks/useAuth.ts            # camelCase with 'use' prefix
lib/formatDate.ts           # camelCase for utilities
types/market.types.ts       # camelCase with .types suffix
```

## Comments & Documentation

### When to Comment
```typescript
// ✅ GOOD: Explain WHY, not WHAT
// Use exponential backoff to avoid overwhelming the API during outages
const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)

// ❌ BAD: Stating the obvious
// Increment counter by 1
count++
```

### JSDoc for Public APIs
```typescript
/**
 * Searches markets using semantic similarity.
 *
 * @param query - Natural language search query
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of markets sorted by similarity score
 * @throws {Error} If API fails or cache unavailable
 *
 * @example
 * ```typescript
 * const results = await searchMarkets('election', 5)
 * ```
 */
export async function searchMarkets(
  query: string,
  limit: number = 10
): Promise<Market[]> { }
```

## Performance Best Practices

### Memoization
```typescript
import { useMemo, useCallback } from 'react'

const sortedMarkets = useMemo(() => {
  return markets.sort((a, b) => b.volume - a.volume)
}, [markets])

const handleSearch = useCallback((query: string) => {
  setSearchQuery(query)
}, [])
```

### Lazy Loading
```typescript
import { lazy, Suspense } from 'react'

const HeavyChart = lazy(() => import('./HeavyChart'))

export function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart data={data} />
    </Suspense>
  )
}
```

### Database Queries
```typescript
// ✅ GOOD: Select only needed columns
const { data } = await supabase
  .from('markets')
  .select('id, name, status')
  .limit(10)

// ❌ BAD: Select everything
const { data } = await supabase.from('markets').select('*')
```

## Testing Standards

### Test Structure (AAA Pattern)
```typescript
test('calculates similarity correctly', () => {
  // Arrange
  const vector1 = [1, 0, 0]
  const vector2 = [0, 1, 0]

  // Act
  const similarity = calculateCosineSimilarity(vector1, vector2)

  // Assert
  expect(similarity).toBe(0)
})
```

### Test Naming
```typescript
// ✅ GOOD
test('returns empty array when no markets match query', () => { })
test('throws error when API key is missing', () => { })

// ❌ BAD
test('works', () => { })
test('test search', () => { })
```

## Code Smell Detection

### Long Functions
```typescript
// ❌ BAD: Function > 50 lines — split into smaller functions
// ✅ GOOD:
function processMarketData() {
  const validated = validateData()
  const transformed = transformData(validated)
  return saveData(transformed)
}
```

### Deep Nesting
```typescript
// ✅ GOOD: Early returns
if (!user) return
if (!user.isAdmin) return
if (!market) return
if (!market.isActive) return
// Do something
```

### Magic Numbers
```typescript
// ✅ GOOD: Named constants
const MAX_RETRIES = 3
const DEBOUNCE_DELAY_MS = 500

if (retryCount > MAX_RETRIES) { }
setTimeout(callback, DEBOUNCE_DELAY_MS)
```

---
**Remember**: Code quality is not negotiable. Clear, maintainable code enables rapid development and confident refactoring.
