from django.conf import settings
from django.http import HttpResponse


class DevCorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if settings.DEBUG and request.method == "OPTIONS":
            response = HttpResponse(status=200)
            return self._set_headers(response, request)

        response = self.get_response(request)
        if settings.DEBUG:
            response = self._set_headers(response, request)
        return response

    def _set_headers(self, response, request):
        origin = request.headers.get("Origin", "*")
        response["Access-Control-Allow-Origin"] = origin
        response["Vary"] = "Origin, Cookie"
        response["Access-Control-Allow-Credentials"] = "true"
        response["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken, Authorization"
        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        return response

