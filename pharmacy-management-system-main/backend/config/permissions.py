from __future__ import annotations

from typing import Iterable

from rest_framework.permissions import BasePermission


ROLE_PRIORITY = [
    'admin',
    'pharmacist',
    'cashier',
    'inventory_clerk',
    'doctor',
    'receptionist',
]


ROLE_SECTION_MAP = {
    'admin': ['Dashboard', 'Prep Queue', 'Prescriptions', 'Patients', 'Inventory', 'Invoices'],
    'pharmacist': ['Dashboard', 'Prep Queue', 'Prescriptions', 'Patients', 'Inventory', 'Invoices'],
    'cashier': ['Dashboard', 'Patients', 'Invoices'],
    'inventory_clerk': ['Dashboard', 'Inventory'],
    'doctor': ['Dashboard', 'Prescriptions', 'Patients'],
    'receptionist': ['Dashboard', 'Patients', 'Prescriptions'],
}


def _normalized_groups(user) -> set[str]:
    return {group.name.strip().lower() for group in user.groups.all()}


def resolve_user_role(user) -> str:
    if not getattr(user, 'is_authenticated', False):
        return 'guest'
    if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
        return 'admin'

    groups = _normalized_groups(user)
    for role in ROLE_PRIORITY:
        if role in groups:
            return role
    return 'pharmacist'


def allowed_sections_for_role(role: str) -> list[str]:
    return ROLE_SECTION_MAP.get(role, ['Dashboard'])


class RolePermission(BasePermission):
    allowed_roles: tuple[str, ...] = ()

    def has_permission(self, request, view):
        user = request.user
        if not getattr(user, 'is_authenticated', False):
            return False
        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            return True
        return bool(_normalized_groups(user).intersection(self.allowed_roles))


def build_role_permission(name: str, roles: Iterable[str]):
    normalized_roles = tuple(role.strip().lower() for role in roles)
    return type(name, (RolePermission,), {'allowed_roles': normalized_roles})


ClinicalAccessPermission = build_role_permission(
    'ClinicalAccessPermission',
    ('admin', 'pharmacist', 'doctor', 'receptionist'),
)

DoctorWorkflowPermission = build_role_permission(
    'DoctorWorkflowPermission',
    ('admin', 'doctor', 'pharmacist'),
)

InventoryAccessPermission = build_role_permission(
    'InventoryAccessPermission',
    ('admin', 'pharmacist', 'inventory_clerk'),
)

DispensingAccessPermission = build_role_permission(
    'DispensingAccessPermission',
    ('admin', 'pharmacist'),
)

BillingAccessPermission = build_role_permission(
    'BillingAccessPermission',
    ('admin', 'pharmacist', 'cashier'),
)
