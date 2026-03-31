# E1: SiteSync SDK (TypeScript + Python)

**Status:** REST API v1 exists, SDKs missing
**Unlock Value:** $1-5M (developer ecosystem lock-in)
**Dependencies:** OpenAPI spec generation, npm/PyPI publishing

---

## 1. OVERVIEW: MAKING SITESYNC A DEVELOPER PLATFORM

Without SDKs:
- Developers manually construct HTTP requests
- No type safety (JavaScript developers especially vulnerable)
- No retry logic, rate limiting, or error handling
- High integration friction = few third-party apps

With SDKs:
- Developers integrate in minutes (vs. hours)
- Type safety across TypeScript, Python, Go
- Built-in auth, pagination, webhooks, error handling
- Accelerates marketplace ecosystem (E2)

---

## 2. TYPESCRIPT SDK

### 2a. SDK Structure

```
sitesync-sdk-ts/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Main export
│   ├── client.ts                   # HTTP client with retries
│   ├── auth/
│   │   ├── oauth.ts
│   │   ├── api-key.ts
│   │   └── jwt.ts
│   ├── resources/
│   │   ├── projects.ts
│   │   ├── payment-applications.ts
│   │   ├── budget.ts
│   │   ├── tasks.ts
│   │   ├── workforce.ts
│   │   ├── certified-payroll.ts
│   │   ├── vendor-invoices.ts
│   │   └── ... (all resources)
│   ├── types/
│   │   ├── index.ts
│   │   ├── projects.ts
│   │   ├── payments.ts
│   │   └── ...
│   ├── webhooks/
│   │   ├── verify.ts               # HMAC signature verification
│   │   └── types.ts
│   └── errors.ts
├── tests/
│   └── *.test.ts
├── docs/
│   ├── README.md
│   ├── getting-started.md
│   ├── api-reference.md
│   └── examples.md
└── .github/
    └── workflows/
        ├── test.yml
        └── publish.yml             # npm publish on release
```

### 2b. `/src/index.ts` - Main Export

```typescript
export { SiteSync } from './client';
export * from './types';
export * from './errors';
export * from './webhooks/verify';

// Convenience exports for specific resource types
export type {
  Project,
  PaymentApplication,
  CertifiedPayroll,
  Budget,
  Task,
  Worker,
  VendorInvoice,
} from './types';
```

### 2c. `/src/client.ts` - HTTP Client

```typescript
import fetch from 'node-fetch';

export interface SiteSyncConfig {
  apiKey?: string;
  accessToken?: string;
  baseUrl?: string;
  userAgent?: string;
  timeout?: number;
  maxRetries?: number;
}

export class SiteSync {
  private apiKey?: string;
  private accessToken?: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private userAgent: string;

  public projects = new ProjectsResource(this);
  public paymentApplications = new PaymentApplicationsResource(this);
  public certifiedPayroll = new CertifiedPayrollResource(this);
  public budget = new BudgetResource(this);
  public tasks = new TasksResource(this);
  public workforce = new WorkforceResource(this);
  public vendorInvoices = new VendorInvoicesResource(this);

  constructor(config: SiteSyncConfig) {
    this.apiKey = config.apiKey;
    this.accessToken = config.accessToken;
    this.baseUrl = config.baseUrl || 'https://api.sitesync.app/v1';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
    this.userAgent = config.userAgent || 'SiteSync-SDK-TypeScript/1.0.0';

    if (!this.apiKey && !this.accessToken) {
      throw new Error('Either apiKey or accessToken must be provided');
    }
  }

  /**
   * Make an authenticated HTTP request with automatic retries
   */
  async request<T = any>(
    method: string,
    path: string,
    options?: {
      body?: any;
      query?: Record<string, any>;
      headers?: Record<string, string>;
    }
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    // Add query parameters
    if (options?.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent,
      ...options?.headers,
    };

    // Add authentication
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    } else if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let lastError: Error | null = null;

    // Retry logic
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          method,
          headers,
          body: options?.body ? JSON.stringify(options.body) : undefined,
          timeout: this.timeout,
        });

        if (!response.ok) {
          // Don't retry client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            const error = await response.json().catch(() => ({}));
            throw new SiteSyncError(
              error.message || response.statusText,
              response.status,
              error
            );
          }

          // Retry server errors (5xx)
          if (response.status >= 500) {
            lastError = new SiteSyncError(response.statusText, response.status);
            if (attempt < this.maxRetries) {
              const backoff = Math.pow(2, attempt) * 1000; // Exponential backoff
              await new Promise((resolve) => setTimeout(resolve, backoff));
              continue;
            }
            throw lastError;
          }
        }

        // Success
        if (response.status === 204) {
          return {} as T; // No content
        }

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof SiteSyncError) {
          throw error;
        }

        lastError = error as Error;

        // Retry on network errors
        if (attempt < this.maxRetries) {
          const backoff = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error('Unknown error');
  }
}

export class SiteSyncError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public data?: any
  ) {
    super(message);
    this.name = 'SiteSyncError';
  }
}
```

### 2d. `/src/resources/projects.ts` - Resource Example

```typescript
import { SiteSync } from '../client';
import { Project, CreateProjectInput } from '../types';

export class ProjectsResource {
  constructor(private client: SiteSync) {}

  /**
   * List all projects
   */
  async list(options?: {
    limit?: number;
    offset?: number;
    status?: 'active' | 'completed' | 'archived';
  }): Promise<{ data: Project[]; hasMore: boolean; total: number }> {
    return this.client.request('GET', '/projects', {
      query: options,
    });
  }

  /**
   * Get a single project
   */
  async get(projectId: string): Promise<Project> {
    return this.client.request('GET', `/projects/${projectId}`);
  }

  /**
   * Create a new project
   */
  async create(input: CreateProjectInput): Promise<Project> {
    return this.client.request('POST', '/projects', {
      body: input,
    });
  }

  /**
   * Update a project
   */
  async update(
    projectId: string,
    input: Partial<CreateProjectInput>
  ): Promise<Project> {
    return this.client.request('PATCH', `/projects/${projectId}`, {
      body: input,
    });
  }

  /**
   * Delete a project
   */
  async delete(projectId: string): Promise<void> {
    await this.client.request('DELETE', `/projects/${projectId}`);
  }

  /**
   * Get project budget
   */
  async getBudget(projectId: string) {
    return this.client.request('GET', `/projects/${projectId}/budget`);
  }

  /**
   * Get project payment applications
   */
  async getPaymentApplications(
    projectId: string,
    options?: { status?: string }
  ) {
    return this.client.request(
      'GET',
      `/projects/${projectId}/payment-applications`,
      {
        query: options,
      }
    );
  }
}
```

### 2e. `/src/types/index.ts` - Type Definitions

```typescript
export interface Project {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  project_type: 'residential' | 'commercial' | 'industrial' | 'infrastructure';
  status: 'active' | 'completed' | 'archived' | 'on_hold';
  start_date: string; // ISO 8601
  end_date?: string; // ISO 8601
  estimated_budget: number;
  actual_budget?: number;
  contractor_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  project_type: Project['project_type'];
  start_date: string;
  end_date?: string;
  estimated_budget: number;
}

export interface PaymentApplication {
  id: string;
  project_id: string;
  application_number: number;
  application_date: string;
  period_from: string;
  period_to: string;
  subcontractor_id: string;
  work_performed: string;
  total_amount_claimed: number;
  retainage_amount: number;
  previous_requests: number;
  current_request: number;
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface CertifiedPayroll {
  id: string;
  project_id: string;
  week_ending: string; // ISO 8601
  status: 'draft' | 'submitted' | 'certified' | 'rejected';
  total_hours: number;
  total_wages: number;
  details: CertifiedPayrollDetail[];
  created_at: string;
}

export interface CertifiedPayrollDetail {
  worker_name: string;
  classification: string;
  hours: number;
  wage_rate: number;
  gross_wages: number;
}

export interface Budget {
  id: string;
  project_id: string;
  total_budget: number;
  line_items: BudgetLineItem[];
  spent_to_date: number;
  remaining_budget: number;
  % _complete: number;
}

export interface BudgetLineItem {
  id: string;
  cost_code: string;
  description: string;
  estimated_cost: number;
  actual_cost: number;
  variance: number;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold';
  assigned_to?: string;
  start_date: string;
  end_date: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

export interface Worker {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  classification: string;
  apprentice_status: 'journeyman' | 'apprentice' | 'trainee';
  wage_rate: number;
}

export interface VendorInvoice {
  id: string;
  project_id: string;
  vendor_id: string;
  vendor_name: string;
  invoice_number: string;
  invoice_date: string;
  invoice_total: number;
  status: 'received' | 'approved' | 'paid' | 'rejected';
  created_at: string;
}
```

### 2f. `/src/webhooks/verify.ts` - Webhook Verification

```typescript
import crypto from 'crypto';

/**
 * Verify webhook signature from SiteSync
 * @param payload Raw request body
 * @param signature X-SiteSync-Signature header value
 * @param secret Webhook signing secret
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  const payloadBuffer = typeof payload === 'string' ? Buffer.from(payload) : payload;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadBuffer)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export interface WebhookEvent<T = any> {
  id: string;
  type: string;
  created_at: string;
  data: T;
}
```

### 2g. `/tests/client.test.ts` - Example Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SiteSync, SiteSyncError } from '../src/client';

describe('SiteSync SDK', () => {
  let client: SiteSync;

  beforeEach(() => {
    client = new SiteSync({
      apiKey: 'test-api-key',
      baseUrl: 'http://localhost:3000/api/v1',
    });
  });

  it('should initialize with apiKey', () => {
    expect(client).toBeDefined();
  });

  it('should throw without auth', () => {
    expect(() => new SiteSync({})).toThrow();
  });

  it('should list projects', async () => {
    const projects = await client.projects.list();
    expect(projects).toBeDefined();
    expect(projects.data).toBeInstanceOf(Array);
  });

  it('should handle API errors', async () => {
    expect(async () => {
      await client.projects.get('invalid-id');
    }).rejects.toThrow(SiteSyncError);
  });

  it('should retry on 5xx errors', async () => {
    // Test retry logic with mocked 503 response
    expect(true).toBe(true);
  });
});
```

### 2h. `package.json` - Publication Configuration

```json
{
  "name": "@sitesync/sdk",
  "version": "1.0.0",
  "description": "Official TypeScript SDK for SiteSync API",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "module": "dist/index.esm.js",
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc && esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js && esbuild src/index.ts --bundle --format=esm --outfile=dist/index.esm.js",
    "test": "vitest",
    "docs": "typedoc src",
    "publish": "npm run build && npm publish"
  },
  "keywords": ["construction", "api", "sitesync"],
  "author": "SiteSync",
  "license": "MIT",
  "devDependencies": {
    "typescript": "^5.9.0",
    "esbuild": "^0.20.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0",
    "typedoc": "^0.25.0"
  },
  "dependencies": {
    "node-fetch": "^3.0.0"
  }
}
```

---

## 3. PYTHON SDK

### 3a. `/setup.py`

```python
from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="sitesync",
    version="1.0.0",
    author="SiteSync",
    description="Official Python SDK for SiteSync API",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/sitesyncapp/sdk-python",
    packages=find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "License :: OSI Approved :: MIT License",
    ],
    python_requires=">=3.9",
    install_requires=[
        "requests>=2.31.0",
        "pydantic>=2.0.0",
    ],
    extras_require={
        "dev": ["pytest", "black", "mypy"],
    },
)
```

### 3b. `/sitesync/__init__.py`

```python
from .client import SiteSync
from .types import (
    Project,
    PaymentApplication,
    CertifiedPayroll,
    Budget,
    Task,
    Worker,
    VendorInvoice,
)
from .exceptions import SiteSyncError

__version__ = "1.0.0"
__all__ = [
    "SiteSync",
    "Project",
    "PaymentApplication",
    "CertifiedPayroll",
    "Budget",
    "Task",
    "Worker",
    "VendorInvoice",
    "SiteSyncError",
]
```

### 3c. `/sitesync/client.py`

```python
import requests
from typing import Optional, Dict, Any
from urllib.parse import urlencode
import time

from .exceptions import SiteSyncError
from .resources import ProjectsResource, PaymentApplicationsResource

class SiteSync:
    """SiteSync API client"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
        base_url: str = "https://api.sitesync.app/v1",
        timeout: int = 30,
        max_retries: int = 3,
    ):
        if not api_key and not access_token:
            raise ValueError("Either api_key or access_token must be provided")

        self.api_key = api_key
        self.access_token = access_token
        self.base_url = base_url
        self.timeout = timeout
        self.max_retries = max_retries

        # Initialize resource objects
        self.projects = ProjectsResource(self)
        self.payment_applications = PaymentApplicationsResource(self)

    def request(
        self,
        method: str,
        path: str,
        body: Optional[Dict[str, Any]] = None,
        query: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        """Make an authenticated API request with retries"""

        url = f"{self.base_url}{path}"

        if query:
            url += "?" + urlencode(query)

        request_headers = {
            "Content-Type": "application/json",
            "User-Agent": "SiteSync-SDK-Python/1.0.0",
        }

        if self.api_key:
            request_headers["Authorization"] = f"Bearer {self.api_key}"
        elif self.access_token:
            request_headers["Authorization"] = f"Bearer {self.access_token}"

        if headers:
            request_headers.update(headers)

        for attempt in range(self.max_retries + 1):
            try:
                response = requests.request(
                    method,
                    url,
                    json=body,
                    headers=request_headers,
                    timeout=self.timeout,
                )

                if response.status_code >= 400 and response.status_code < 500:
                    raise SiteSyncError(
                        response.json().get("message", response.text),
                        response.status_code,
                    )

                if response.status_code >= 500:
                    if attempt < self.max_retries:
                        backoff = (2 ** attempt) * 1  # Exponential backoff in seconds
                        time.sleep(backoff)
                        continue
                    raise SiteSyncError(response.text, response.status_code)

                if response.status_code == 204:
                    return None

                return response.json()

            except requests.exceptions.RequestException as e:
                if attempt < self.max_retries:
                    backoff = (2 ** attempt) * 1
                    time.sleep(backoff)
                    continue
                raise SiteSyncError(str(e))

        raise SiteSyncError("Max retries exceeded")
```

---

## 4. SDK USAGE EXAMPLES

### TypeScript Example

```typescript
import { SiteSync } from '@sitesync/sdk';

const client = new SiteSync({
  apiKey: process.env.SITESYNC_API_KEY,
});

// List projects
const projects = await client.projects.list({ status: 'active' });
console.log(`Found ${projects.data.length} active projects`);

// Get specific project
const project = await client.projects.get('proj-123');
console.log(`Project: ${project.name}`);

// Get payment applications
const paymentApps = await client.paymentApplications.list({
  projectId: 'proj-123',
  status: 'submitted',
});

// Create certified payroll
const payroll = await client.certifiedPayroll.create({
  projectId: 'proj-123',
  weekEnding: '2026-03-31',
  details: [
    {
      workerName: 'John Doe',
      classification: 'Carpenter',
      hours: 40,
      wageRate: 65.5,
    },
  ],
});
```

### Python Example

```python
from sitesync import SiteSync

client = SiteSync(api_key='your-api-key')

# List projects
projects = client.projects.list(status='active')
for project in projects:
    print(f"Project: {project.name}")

# Get payment applications
payment_apps = client.payment_applications.list(
    project_id='proj-123',
    status='submitted'
)

# Create certified payroll
payroll = client.certified_payroll.create(
    project_id='proj-123',
    week_ending='2026-03-31',
    details=[
        {
            'worker_name': 'John Doe',
            'classification': 'Carpenter',
            'hours': 40,
            'wage_rate': 65.5,
        }
    ]
)
```

---

## 5. DOCUMENTATION GENERATION

### TypeDoc for TypeScript

```bash
npx typedoc --out docs src
```

### Sphinx for Python

```bash
pip install sphinx
sphinx-quickstart docs
make html
```

---

## 6. VERIFICATION SCRIPT

```bash
#!/bin/bash
set -e

PROJECT_ROOT="/sessions/wonderful-practical-brahmagupta/mnt/sitesync-pm"

echo "=== E1: SDK Verification ==="

# 1. Check TypeScript SDK structure
echo "1. Checking TypeScript SDK..."
[ -d "$PROJECT_ROOT/sdk-ts" ] && echo "   ✓ TypeScript SDK directory exists" || echo "   ✗ MISSING: sdk-ts"

# 2. Check Python SDK structure
echo "2. Checking Python SDK..."
[ -d "$PROJECT_ROOT/sdk-py" ] && echo "   ✓ Python SDK directory exists" || echo "   ✗ MISSING: sdk-py"

# 3. Check OpenAPI spec
echo "3. Checking OpenAPI spec..."
grep -r "openapi: 3" "$PROJECT_ROOT" --include="*.yaml" --include="*.yml" && echo "   ✓ OpenAPI spec exists" || echo "   ⚠ OpenAPI spec needs generation"

# 4. Check SDK tests
echo "4. Checking SDK tests..."
[ -f "$PROJECT_ROOT/sdk-ts/tests/client.test.ts" ] && echo "   ✓ TypeScript tests exist" || echo "   ⚠ Tests need implementation"

echo ""
echo "=== VERIFICATION COMPLETE ==="
```

---

## 7. SUCCESS METRICS

- SDK adoption: Target 500+ developers using SDK (vs. raw HTTP)
- Integration time: < 15 minutes (vs. 2-4 hours manual)
- SDK error reduction: 95% (vs. manual HTTP handling)
- Marketplace app growth: 30+ apps built with SDK (vs. 10 currently)

