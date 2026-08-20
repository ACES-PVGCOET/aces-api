# ACES API — Developer & Contribution Guide

Welcome to the **ACES API** repository! This document serves as the comprehensive guide for onboarding developers, maintaining strict architectural integrity, writing clean code, and adhering to our standardized GitHub contribution workflow.

---

## Table of Contents

1. [Developer Setup Guide](#1-developer-setup-guide)
   - [1.1 Prerequisites](#11-prerequisites)
   - [1.2 Project Installation](#12-project-installation)
   - [1.3 Environment Configuration](#13-environment-configuration)
   - [1.4 Database Setup & Initialization](#14-database-setup--initialization)
   - [1.5 Running the Server](#15-running-the-server)
   - [1.6 Code Linting & Verification](#16-code-linting--verification)
2. [Code Writing & Modification Rules](#2-code-writing--modification-rules)
   - [2.1 Architecture & Modular Monolith Pattern](#21-architecture--modular-monolith-pattern)
   - [2.2 Strict Module Boundary Enforcement](#22-strict-module-boundary-enforcement)
   - [2.3 Code Conventions & Standard Practices](#23-code-conventions--standard-practices)
   - [2.4 API Envelope & Error Handling](#24-api-envelope--error-handling)
   - [2.5 Mongoose Schemas & Auditing Rules](#25-mongoose-schemas--auditing-rules)
   - [2.6 Presigned Media Upload Flow](#26-presigned-media-upload-flow)
3. [GitHub Contribution Workflow](#3-github-contribution-workflow)
   - [3.1 Branching Strategy](#31-branching-strategy)
   - [3.2 Commit Message Standards](#32-commit-message-standards)
   - [3.3 Raising a Structured Pull Request (PR)](#33-raising-a-structured-pull-request-pr)
   - [3.4 Code Review & Merge Guidelines](#34-code-review--merge-guidelines)

---

## 1. Developer Setup Guide

### 1.1 Prerequisites

Before setting up the project locally, ensure you have installed:

* **Node.js**: `v18.x` or later (LTS recommended)
* **npm**: `v9.x` or later (bundled with Node.js)
* **MongoDB**: `v6.0` or later (local instance running on port `27017` or MongoDB Atlas connection string)
* **Git**: `v2.x` or later

Verify installed versions:
```bash
node -v
npm -v
git --version
mongod --version
```

### 1.2 Project Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/aces-association/aces_api.git
   cd aces_api
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

### 1.3 Environment Configuration

1. **Create local environment file**:
   Copy `.env.example` to create `.env` in the root directory:
   ```bash
   cp .env.example .env
   ```

2. **Configure Environment Variables**:
   Open `.env` and fill in the required key-value pairs:

   ```env
   # Server Environment Configuration
   NODE_ENV=development
   PORT=5000
   CLIENT_ORIGIN=http://localhost:3000

   # Database Configuration
   MONGO_URI=mongodb://localhost:27017/aces_db

   # Security & Authentication
   JWT_SECRET=your_development_jwt_secret_key_change_me
   JWT_EXPIRES_IN=7d

   # Media Storage (Cloudinary)
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret

   # Root Admin Initialization
   INIT_ADMIN_EMAIL=admin@aces.org
   INIT_ADMIN_PASSWORD=Admin@123456

   # Resend Email Configuration
   RESEND_API_KEY=re_your_resend_api_key
   RESEND_FROM=ACES Association <onboarding@resend.dev>
   ```

> [!CAUTION]
> Never commit your actual `.env` file or production secrets to Git. Ensure `.env` remains listed in `.gitignore`.

### 1.4 Database Setup & Initialization

1. Ensure your MongoDB daemon is running locally or your Atlas connection URI is accessible:
   ```bash
   # Linux service check (if using local MongoDB)
   sudo systemctl status mongod
   ```

2. **Root Admin Auto-Initialization**:
   On initial boot, the server checks if a root administrator user exists. If missing, it automatically creates the root admin using `INIT_ADMIN_EMAIL` and `INIT_ADMIN_PASSWORD` defined in `.env`.

Tip: You can use MongoDB atlas for simple setup.

### 1.5 Running the Server

* **Development Mode (with auto-reload via `nodemon`)**:
  ```bash
  npm run dev
  ```
  The server will start at `http://localhost:5000`.

* **Production Mode**:
  ```bash
  npm start
  ```

### 1.6 Code Linting & Verification

Before pushing code, run ESLint to ensure cross-module boundaries and coding guidelines are respected:

```bash
npm run lint
```

---

## 2. Code Writing & Modification Rules

### 2.1 Architecture & Modular Monolith Pattern

The **ACES API** follows a strict **Modular Monolith Architecture** with **Package-Oriented Design**. The project is split into isolated domain modules:

```text
aces_api/
├── orchestration/          # Gateway Layer: Route mapping, global auth, error handling
├── iam/                    # Identity & Access Management Module
│   ├── index.js            # PUBLIC MODULE CONTRACT (Exposes IAMService)
│   ├── internal/           # PRIVATE DOMAIN (Schemas, DB queries, private helpers)
│   └── http/               # HTTP Controllers & Endpoint Routers
├── events/                 # Event Lifecycle Management Module
├── forms/                  # Dynamic Forms & Response Aggregation Module
├── announcements/          # Broadcast & Public News Module
└── gallery/                # Media & Digital Asset Management Module
```

### 2.2 Strict Module Boundary Enforcement

To maintain domain isolation and prevent cross-domain spaghetti code:

1. **Private `internal/` Directories**:
   * Code located in `<domain>/internal/` is strictly private to that domain.
   * **Rule**: NO file outside module `X` may import from `X/internal/*`.

2. **Public Module Contract (`index.js`)**:
   * Every domain module exposes its public API through root `index.js`.
   * When Module A requires data or services from Module B, it **must** import exclusively from Module B's `index.js`.

   ```javascript
   // CORRECT: Importing via public service interface
   import { FormsService } from '../forms/index.js';

   // PROHIBITED: Directly accessing private internal models/files
   import { FormModel } from '../forms/internal/forms.model.js';
   ```

3. **Automated Verification**:
   * Module boundaries are automatically enforced using ESLint (`import/no-restricted-paths`). Running `npm run lint` will report any boundary violations as build-breaking errors.

### 2.3 Code Conventions & Standard Practices

* **ES Modules Only**: Use standard ES module syntax (`import`/`export`). CommonJS (`require`/`module.exports`) is not allowed.
* **Asynchronous Logic**: Use `async`/`await` for asynchronous control flows. Avoid chaining `.then()`.
* **Parameter Object Pattern**: For functions with multiple options or parameters, pass a single structured configuration object.
* **Logging Standard**: Use structured log calls (`console.info()`, `console.warn()`, `console.error()`). Do not leave raw `console.log()` debug calls in production-bound code.

### 2.4 API Envelope & Error Handling

All HTTP responses must use our standardized envelope format.

#### Success Response Envelope:
```json
{
  "success": true,
  "data": {
    "id": "60d5ecb8b5c9c22b10a1d8a1",
    "name": "Alex Mercer"
  },
  "error": null
}
```

#### Error Response Envelope:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Question serial 3 exceeds maximum length constraint."
  }
}
```

#### Custom Error Handling:
Throw operational errors using domain custom error classes (e.g., `AppError`, `ValidationError`, `UnauthorizedError`). Never return ad-hoc error shapes from controllers.

```javascript
// Example throwing operational error
if (!member) {
  throw new AppError('Member record not found', 404, 'NOT_FOUND');
}
```

### 2.5 Mongoose Schemas & Auditing Rules

* **Model Location**: Place Mongoose models strictly inside the domain's `internal/` directory (e.g., `iam/internal/iam.model.js`).
* **Auditing Fields**: Every core domain schema must include standard auditing fields:
  * `created_by` (ObjectId referencing IAM Member)
  * `created_at` (Timestamp)
  * `updated_by` (ObjectId referencing IAM Member)
  * `updated_at` (Timestamp)

### 2.6 Presigned Media Upload Flow

To prevent heavy multipart form payloads from blocking Node.js single-threaded event loops:
1. Clients request a presigned upload signature from `GET /api/v1/gallery/upload-signature`.
2. Clients upload binary assets directly to Cloudinary CDN from the frontend.
3. Domain API endpoints accept Cloudinary asset metadata/URLs directly.

---

## 3. GitHub Contribution Workflow

We follow a structured Git & GitHub workflow to ensure stable releases, traceable commits, and high code quality.

```mermaid
flowchart LR
    Main Branch["main"] --> Feature Branch["feature/iam-password-reset"]
    Feature Branch --> Local Commits["feat(iam): add password reset request handler"]
    Local Commits --> PR["Raise Structured PR"]
    PR --> Review["Code Review & CI Checks"]
    Review --> Merge["Squash & Merge to main"]
```

### 3.1 Branching Strategy

All development work takes place in short-lived feature or bugfix branches created from `main`.

#### Branch Naming Format:
`<type>/<domain>-<short-description>`

* **`feature/`**: New feature development
  * Example: `feature/iam-rbac-permissions`, `feature/events-registration-form`
* **`fix/`**: Bug fixes
  * Example: `fix/forms-validation-error`, `fix/iam-jwt-expiration`
* **`refactor/`**: Code restructuring without external interface changes
  * Example: `refactor/orchestration-middleware`
* **`docs/`**: Documentation additions or updates
  * Example: `docs/iam-api-guide`
* **`chore/`**: Tooling, config, or package update tasks
  * Example: `chore/eslint-upgrade`

#### Creating your branch:
```bash
git checkout main
git pull origin main
git checkout -b feature/iam-password-reset
```

### 3.2 Commit Message Standards

We enforce **Conventional Commits** to keep git history clean, readable, and structured.

#### Structure:
```text
<type>(<scope>): <short high-level summary>

[optional detailed description body]

[optional issue/ticket reference]
```

#### Allowed Types:
* `feat`: A new feature for the user or system
* `fix`: A bug fix
* `docs`: Documentation changes
* `style`: Formatting, missing semi-colons, no code logic changes
* `refactor`: Refactoring code without changing functionality
* `test`: Adding missing tests or correcting existing tests
* `chore`: Maintenance, dependencies, build configurations

#### Examples:
```bash
# Feature commit
git commit -m "feat(iam): implement JWT token refresh service"

# Bug fix commit
git commit -m "fix(events): prevent duplicate registration submissions"

# Refactor commit with scope
git commit -m "refactor(orchestration): centralize global error handling middleware"
```

### 3.3 Raising a Structured Pull Request (PR)

When your feature branch is ready for review:

1. **Run local verification**:
   ```bash
   npm run lint
   ```
2. **Push your branch to GitHub**:
   ```bash
   git push -u origin feature/iam-password-reset
   ```
3. **Open a Pull Request on GitHub against `main`**.

#### Standard PR Title Format:
`<type>(<scope>): <summary>` (e.g., `feat(iam): add user profile photo update endpoint`)

#### Standard PR Body Structure:

Use the following Markdown template when opening your PR:

```markdown
## Summary
A concise overview of what changes are introduced by this PR.

## Type of Change
- [ ] 🚀 New Feature (`feat`)
- [ ] 🐛 Bug Fix (`fix`)
- [ ] 🛠️ Refactoring (`refactor`)
- [ ] 📚 Documentation Update (`docs`)
- [ ] ⚙️ Maintenance / Chore (`chore`)

## Key Changes
- Implemented `updateProfilePhoto()` in `iam/internal/iam.service.internal.js`.
- Added public service function in `iam/index.js`.
- Added controller route `PATCH /api/v1/iam/members/profile-photo`.

## Related Issues / Tickets
Closes #42

## Verification & Testing
- [x] Ran `npm run lint` with zero errors.
- [x] Tested endpoint via Postman / curl.
- [x] Verified ESLint package boundary constraints are respected.

## Screenshots / Evidence (if applicable)
[Attach Postman responses or test logs here]
```

### 3.4 Code Review & Merge Guidelines

1. **Review Requirements**:
   * Every PR requires at least **1 approval** from a core tech team member or domain owner before merging.
   * All ESLint CI checks must pass.
2. **Addressing Feedback**:
   * Push fixup commits directly to your branch in response to reviewer feedback.
3. **Merging**:
   * Use **Squash and Merge** on GitHub to maintain a linear and clean history on `main`.
   * Delete feature branches post-merge.

---

*For architectural design details, see [ACES API Architectural Specification]