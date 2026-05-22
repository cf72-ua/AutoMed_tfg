/**
 * Guard de Roles para Angular
 */

import { Injectable } from "@angular/core";
import { CanActivate, ActivatedRouteSnapshot, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";

@Injectable({
  providedIn: "root",
})
export class RoleGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const requiredRoles = route.data["roles"] as string[];
    const userRoles = this.authService.getUserRoles();

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const hasPermission = userRoles.some((role) =>
      requiredRoles.includes(role),
    );

    if (!hasPermission) {
      this.router.navigate(["/unauthorized"]);
      return false;
    }

    return true;
  }
}
