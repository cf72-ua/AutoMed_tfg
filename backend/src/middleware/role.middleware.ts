/**
 * Middleware de Validación de Roles
 * Requiere que authMiddleware haya ejecutado primero
 */

import { Request, Response, NextFunction } from "express";
import type { AuthUser, UserRole } from "../types/index.d";

export interface RoleMiddlewareOptions {
  requireAll?: boolean;
}

export const roleMiddleware = (
  allowedRoles: (string | UserRole)[],
  options?: RoleMiddlewareOptions,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized - No user" });
    }

    const userRoles = req.user.roles || [];
    const requireAll = options?.requireAll || false;

    const allowedRolesStr = allowedRoles.map((role) => String(role));
    const userRolesStr = userRoles.map((role) => String(role));

    let hasAccess = false;
    if (requireAll) {
      hasAccess = allowedRolesStr.every((role) => userRolesStr.includes(role));
    } else {
      hasAccess = allowedRolesStr.some((role) => userRolesStr.includes(role));
    }

    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden - Insufficient permissions",
        requiredRoles: allowedRolesStr,
        userRoles: userRolesStr,
      });
    }

    next();
  };
};

export const requireRole = (
  roles: string | UserRole | (string | UserRole)[],
) => {
  const roleArray = Array.isArray(roles) ? roles : [roles];
  return roleMiddleware(roleArray);
};
