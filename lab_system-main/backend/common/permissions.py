from django.conf import settings
from rest_framework.permissions import BasePermission


class IsStaffOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.is_staff


class RoleBasedPermission(BasePermission):
    role_map = {}

    def has_permission(self, request, view):
        if settings.DEBUG and not (request.user and request.user.is_authenticated):
            return True
        if not request.user or not request.user.is_authenticated:
            return False
        # Superusers/staff can access everything by default
        if request.user.is_superuser or request.user.is_staff:
            return True
        allowed = self.role_map.get(view.basename, None)
        if allowed is None:
            return True
        return request.user.role in allowed


class RoleRequired(BasePermission):
    allowed_roles = []

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        return request.user.role in self.allowed_roles
