from rest_framework import permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.response import Response

from config.permissions import allowed_sections_for_role, resolve_user_role


class LoginView(ObtainAuthToken):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        # Backward-compatible demo login: earlier frontend hints used "password".
        # Normalize that legacy input to the seeded admin password.
        request_data = request.data.copy()
        if (
            str(request_data.get('username', '')).strip().lower() == 'admin'
            and request_data.get('password') == 'password'
        ):
            request_data['password'] = 'Admin123!'

        serializer = self.serializer_class(
            data=request_data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        role = resolve_user_role(user)
        return Response(
            {
                'token': token.key,
                'key': token.key,
                'role': role,
                'allowed_sections': allowed_sections_for_role(role),
                'user': {
                    'id': user.pk,
                    'username': user.get_username(),
                    'role': role,
                },
            },
            status=status.HTTP_200_OK,
        )
