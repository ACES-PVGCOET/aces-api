# IAM (Identity & Access Management) Module

## Overview
The **IAM Module** manages authentication, user registration, sessions, member profiles, and Role-Based Access Control (RBAC).

## Package Boundaries & Interfaces
- **Public Interface (`index.js`)**: Exports `IAMService` containing methods used by other domain modules (such as `verifyToken`, `getMemberById`, `getUserPermissions`).
- **Internal (`internal/`)**: Contains `MemberModel` and internal business logic (`iam.service.internal.js`). **Strictly private to this module.**
- **HTTP (`http/`)**: Express controllers (`iam.controller.js`) and route declarations (`iam.routes.js`).

## Public Service API Methods
```js
import { IAMService } from './iam/index.js';

// Verify token string
const decodedPayload = await IAMService.verifyToken(tokenString);

// Fetch member by ID
const member = await IAMService.getMemberById(memberId);

// Get member permissions
const roles = await IAMService.getUserPermissions(memberId);
```
