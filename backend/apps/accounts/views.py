from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import get_user_model
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.mixins import AuditLogMixin, FilteredQuerysetMixin
from common.permissions import RoleBasedPermission

from .models import User
from .serializers import UserSerializer

ROLE_MAP = {
    'users': ['LAB_TECH', 'RECEPTIONIST'],
    'patients': ['LAB_TECH', 'RECEPTIONIST'],
    'appointments': ['LAB_TECH', 'RECEPTIONIST'],
    'lab-test-types': ['LAB_TECH'],
    'lab-test-orders': ['LAB_TECH'],
    'lab-results': ['LAB_TECH'],
    'scan-types': ['LAB_TECH'],
    'scan-orders': ['LAB_TECH'],
    'scan-results': ['LAB_TECH', 'RECEPTIONIST'],
    'inventory-items': ['RECEPTIONIST', 'LAB_TECH'],
    'inventory-transactions': ['RECEPTIONIST', 'LAB_TECH'],
    'invoices': ['RECEPTIONIST'],
    'payments': ['RECEPTIONIST'],
    'activity-log': ['LAB_TECH'],
}

RoleBasedPermission.role_map = ROLE_MAP


class UserViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = User.objects.all().order_by('id')
    serializer_class = UserSerializer
    exact_filters = {
        "role": "role",
        "is_active": "is_active",
    }

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        # Receptionist can manage users from the user-management UI.
        if getattr(user, "role", None) == User.Roles.RECEPTIONIST:
            return qs
        # Lab tech accounts are limited to self profile.
        if getattr(user, "role", None) == User.Roles.LAB_TECH:
            return qs.filter(id=user.id)
        return qs


class CsrfView(APIView):
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({"detail": "CSRF cookie set"})


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_identifier = request.data.get("username") or request.data.get("email") or ""
        username = raw_identifier.strip()
        password = request.data.get("password") or ""
        user = None

        if username and "@" in username:
            UserModel = get_user_model()
            matched_by_email = UserModel.objects.filter(email__iexact=username).order_by("-id")

            # Prefer exact email+password match to avoid failures from username mapping edge cases.
            for candidate in matched_by_email:
                if candidate.check_password(password):
                    user = candidate
                    break

            if user is None:
                mapped = matched_by_email.first()
                if mapped:
                    user = authenticate(request, username=mapped.username, password=password)
        else:
            user = authenticate(request, username=username, password=password)

        if not user:
            return Response({"detail": "Invalid credentials"}, status=400)
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({"detail": "Logged out"})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)



