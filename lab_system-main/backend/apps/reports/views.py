from datetime import date, timedelta

from django.db import models
from django.db.models import Count, Sum
from django.db.models.functions import TruncDate, TruncWeek
from django.utils.dateparse import parse_date
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import RoleRequired
from apps.inventory.models import InventoryItem
from apps.lab.models import LabTestOrder
from apps.scans.models import ScanOrder
from apps.billing.models import Invoice, Payment


def _parse_range(request, default_days=7):
    today = date.today()
    start_raw = request.query_params.get("date_from")
    end_raw = request.query_params.get("date_to")
    if start_raw:
        start = parse_date(start_raw) or (today - timedelta(days=default_days))
    else:
        start = today - timedelta(days=default_days)
    if end_raw:
        end = parse_date(end_raw) or today
    else:
        end = today
    return start, end


class TestsReportPermission(RoleRequired):
    allowed_roles = ["LAB_TECH", "RECEPTIONIST"]


class RevenueReportPermission(RoleRequired):
    allowed_roles = ["RECEPTIONIST", "LAB_TECH"]


class InventoryReportPermission(RoleRequired):
    allowed_roles = ["RECEPTIONIST", "LAB_TECH"]


class DailyTestsReportView(APIView):
    permission_classes = [IsAuthenticated, TestsReportPermission]

    def get(self, request):
        start, end = _parse_range(request, default_days=7)

        lab = (
            LabTestOrder.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        scans = (
            ScanOrder.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        return Response({"from": str(start), "to": str(end), "lab": list(lab), "scans": list(scans)})


class WeeklyTestsReportView(APIView):
    permission_classes = [IsAuthenticated, TestsReportPermission]

    def get(self, request):
        start, end = _parse_range(request, default_days=30)

        lab = (
            LabTestOrder.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
            .annotate(week=TruncWeek("created_at"))
            .values("week")
            .annotate(count=Count("id"))
            .order_by("week")
        )
        scans = (
            ScanOrder.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
            .annotate(week=TruncWeek("created_at"))
            .values("week")
            .annotate(count=Count("id"))
            .order_by("week")
        )
        return Response({"from": str(start), "to": str(end), "lab": list(lab), "scans": list(scans)})


class RevenueReportView(APIView):
    permission_classes = [IsAuthenticated, RevenueReportPermission]

    def get(self, request):
        start, end = _parse_range(request, default_days=30)
        invoices = (
            Invoice.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
            .aggregate(total=Sum("total"))
            .get("total")
            or 0
        )
        payments = (
            Payment.objects.filter(paid_at__date__gte=start, paid_at__date__lte=end)
            .aggregate(total=Sum("amount"))
            .get("total")
            or 0
        )
        return Response({"from": str(start), "to": str(end), "invoiced_total": invoices, "paid_total": payments})


class InventoryReportView(APIView):
    permission_classes = [IsAuthenticated, InventoryReportPermission]

    def get(self, request):
        low = InventoryItem.objects.filter(quantity__lte=models.F("reorder_level"))
        return Response({"low_stock": low.count()})



