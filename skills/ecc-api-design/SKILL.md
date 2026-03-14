---
name: ecc-api-design
description: REST API design conventions including resource naming, HTTP methods, status codes, pagination (offset and cursor), filtering, sorting, error responses, versioning, rate limiting, and authentication patterns. Use when designing, reviewing, or documenting API endpoints.
---

# API Design Patterns

Conventions and best practices for designing consistent, developer-friendly REST APIs.

## When to Activate

- Designing new API endpoints
- Reviewing existing API contracts
- Adding pagination, filtering, or sorting
- Implementing error handling for APIs
- Planning API versioning strategy
- Building public or partner-facing APIs

## Resource Design

### URL Structure
```
# Resources are nouns, plural, lowercase, kebab-case
GET /api/v1/users
GET /api/v1/users/:id
POST /api/v1/users
PUT /api/v1/users/:id
PATCH /api/v1/users/:id
DELETE /api/v1/users/:id

# Sub-resources for relationships
GET /api/v1/users/:id/orders
POST /api/v1/users/:id/orders

# Actions that don't map to CRUD (use verbs sparingly)
POST /api/v1/orders/:id/cancel
POST /api/v1/auth/login
```

### Naming Rules
```
# GOOD
/api/v1/team-members
/api/v1/orders?status=active
/api/v1/users/123/orders

# BAD
/api/v1/getUsers                  # verb in URL
/api/v1/user                      # singular
/api/v1/team_members              # snake_case in URLs
```

## HTTP Methods and Status Codes

### Method Semantics

| Method | Idempotent | Safe | Use For |
|--------|-----------|------|---------|
| GET | Yes | Yes | Retrieve resources |
| POST | No | No | Create resources, trigger actions |
| PUT | Yes | No | Full replacement of a resource |
| PATCH | No* | No | Partial update of a resource |
| DELETE | Yes | No | Remove a resource |

### Status Code Reference

```
# Success
200 OK — GET, PUT, PATCH (with response body)
201 Created — POST (include Location header)
204 No Content — DELETE, PUT (no response body)

# Client Errors
400 Bad Request — Validation failure, malformed JSON
401 Unauthorized — Missing or invalid authentication
403 Forbidden — Authenticated but not authorized
404 Not Found — Resource doesn't exist
409 Conflict — Duplicate entry, state conflict
422 Unprocessable Entity — Semantically invalid
429 Too Many Requests — Rate limit exceeded

# Server Errors
500 Internal Server Error — Unexpected failure
502 Bad Gateway — Upstream service failed
503 Service Unavailable — Temporary overload
```

## Response Format

### Success Response
```json
{
  "data": {
    "id": "abc-123",
    "email": "alice@example.com",
    "name": "Alice",
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

### Collection Response (with Pagination)
```json
{
  "data": [
    { "id": "abc-123", "name": "Alice" },
    { "id": "def-456", "name": "Bob" }
  ],
  "meta": {
    "total": 142,
    "page": 1,
    "per_page": 20,
    "total_pages": 8
  },
  "links": {
    "self": "/api/v1/users?page=1&per_page=20",
    "next": "/api/v1/users?page=2&per_page=20",
    "last": "/api/v1/users?page=8&per_page=20"
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address",
        "code": "invalid_format"
      }
    ]
  }
}
```

## Pagination

### Offset-Based (Simple)
```
GET /api/v1/users?page=2&per_page=20
```
**Pros:** Easy, supports "jump to page N"
**Cons:** Slow on large offsets, inconsistent with concurrent inserts

### Cursor-Based (Scalable)
```
GET /api/v1/users?cursor=eyJpZCI6MTIzfQ&limit=20
```
```json
{
  "data": [...],
  "meta": {
    "has_next": true,
    "next_cursor": "eyJpZCI6MTQzfQ"
  }
}
```
**Pros:** Consistent performance, stable with concurrent inserts
**Cons:** Cannot jump to arbitrary page

### When to Use Which

| Use Case | Pagination Type |
|----------|----------------|
| Admin dashboards, small datasets | Offset |
| Infinite scroll, feeds, large datasets | Cursor |
| Public APIs | Cursor (default) |
| Search results | Offset |

## Filtering, Sorting, and Search

```
# Equality
GET /api/v1/orders?status=active&customer_id=abc-123

# Comparison operators
GET /api/v1/products?price[gte]=10&price[lte]=100

# Multiple values
GET /api/v1/products?category=electronics,clothing

# Sorting (prefix - for descending)
GET /api/v1/products?sort=-created_at

# Multiple sort fields
GET /api/v1/products?sort=-featured,price,-created_at

# Full-text search
GET /api/v1/products?q=wireless+headphones

# Sparse fieldsets
GET /api/v1/users?fields=id,name,email
```

## Rate Limiting

### Headers
```
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000

# When exceeded
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

### Rate Limit Tiers

| Tier | Limit | Window | Use Case |
|------|-------|--------|----------|
| Anonymous | 30/min | Per IP | Public endpoints |
| Authenticated | 100/min | Per user | Standard API access |
| Premium | 1000/min | Per API key | Paid API plans |

## Versioning

### URL Path Versioning (Recommended)
```
/api/v1/users
/api/v2/users
```

### Versioning Strategy
1. Start with `/api/v1/` — don't version until you need to
2. Maintain at most 2 active versions
3. Non-breaking changes don't need a new version (adding fields, optional params)
4. Breaking changes require a new version (removing fields, changing types)
5. Add `Sunset` header for deprecation: `Sunset: Sat, 01 Jan 2026 00:00:00 GMT`

## API Design Checklist

Before shipping a new endpoint:
- [ ] Resource URL follows naming conventions (plural, kebab-case, no verbs)
- [ ] Correct HTTP method used
- [ ] Appropriate status codes returned
- [ ] Input validated with schema (Zod, Pydantic, etc.)
- [ ] Error responses follow standard format
- [ ] Pagination implemented for list endpoints
- [ ] Authentication required (or explicitly marked as public)
- [ ] Authorization checked
- [ ] Rate limiting configured
- [ ] Response does not leak internal details
- [ ] Consistent naming with existing endpoints
- [ ] Documented (OpenAPI/Swagger spec updated)
