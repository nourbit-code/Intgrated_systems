import json

from django.test import Client, TestCase, override_settings

from apps.accounts.models import User


@override_settings(ALLOWED_HOSTS=["testserver", "127.0.0.1", "localhost"])
class AccountsAuthAndProfileTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.base = "/api/v1"
        self.lab_tech_password = "LAB_TECHPass123!"
        self.lab_tech_user = User.objects.create_user(
            username="lab_tech_owner",
            email="lab_tech_owner@example.com",
            password=self.lab_tech_password,
            role=User.Roles.LAB_TECH,
        )

    def _get_csrf_token(self, client: Client) -> str:
        response = client.get(f"{self.base}/auth/csrf")
        self.assertEqual(response.status_code, 200)
        token = response.cookies.get("csrftoken")
        self.assertIsNotNone(token)
        return token.value

    def _login(self, client: Client, username: str, password: str):
        csrf = self._get_csrf_token(client)
        response = client.post(
            f"{self.base}/auth/login",
            data=json.dumps({"username": username, "password": password}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, 200, response.content)

    def test_create_user_with_profile_photo_and_read_it_back_via_me(self):
        self._login(self.client, self.lab_tech_user.username, self.lab_tech_password)

        create_csrf = self._get_csrf_token(self.client)
        photo_data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA"
        created_password = "Reception123!"
        created_username = "reception_profile_1"

        create_response = self.client.post(
            f"{self.base}/users/",
            data=json.dumps(
                {
                    "username": created_username,
                    "email": "reception_profile_1@example.com",
                    "role": User.Roles.RECEPTIONIST,
                    "password": created_password,
                    "photo_data_url": photo_data_url,
                }
            ),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=create_csrf,
        )
        self.assertEqual(create_response.status_code, 201, create_response.content)

        created_user = User.objects.get(username=created_username)
        self.assertEqual(created_user.photo_data_url, photo_data_url)

        # New session for created user to verify profile payload after login.
        user_client = Client(enforce_csrf_checks=True)
        self._login(user_client, created_username, created_password)

        me_response = user_client.get(f"{self.base}/auth/me")
        self.assertEqual(me_response.status_code, 200, me_response.content)
        me_json = me_response.json()
        self.assertEqual(me_json["username"], created_username)
        self.assertEqual(me_json["photo_data_url"], photo_data_url)

    def test_duplicate_username_returns_validation_error(self):
        self._login(self.client, self.lab_tech_user.username, self.lab_tech_password)
        create_csrf = self._get_csrf_token(self.client)

        payload = {
            "username": self.lab_tech_user.username,
            "password": "AnyPass123!",
        }

        response = self.client.post(
            f"{self.base}/users/",
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=create_csrf,
        )
        self.assertEqual(response.status_code, 400, response.content)
        body = response.json()
        self.assertIn("username", body)

