from datetime import date
from typing import Dict, Iterable

from django.utils.dateparse import parse_date

from apps.audit.models import ActivityLog


class FilteredQuerysetMixin:
    exact_filters: Dict[str, str] = {}
    date_fields: Iterable[str] = ()

    def apply_filters(self, queryset):
        params = self.request.query_params
        # exact filters
        for param, lookup in self.exact_filters.items():
            value = params.get(param)
            if value not in (None, ""):
                queryset = queryset.filter(**{lookup: value})
        # date range filters (YYYY-MM-DD)
        for field in self.date_fields:
            start = params.get(f"{field}_from")
            end = params.get(f"{field}_to")
            if start:
                dt = parse_date(start)
                if isinstance(dt, date):
                    queryset = queryset.filter(**{f"{field}__date__gte": dt})
            if end:
                dt = parse_date(end)
                if isinstance(dt, date):
                    queryset = queryset.filter(**{f"{field}__date__lte": dt})
        return queryset

    def get_queryset(self):
        queryset = super().get_queryset()
        return self.apply_filters(queryset)


class AuditLogMixin:
    audit_entity_name: str | None = None

    def _log(self, action: str, instance):
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return
        entity_type = self.audit_entity_name or instance.__class__.__name__
        ActivityLog.objects.create(
            user=user,
            action=action,
            entity_type=entity_type,
            entity_id=str(instance.pk),
            metadata={"path": self.request.path, "method": self.request.method},
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        self._log("create", instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        self._log("update", instance)

    def perform_destroy(self, instance):
        self._log("delete", instance)
        instance.delete()
