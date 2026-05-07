from rest_framework import serializers

from .models import ScanOrder, ScanResult, ScanType


class ScanTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScanType
        fields = '__all__'


class ScanOrderSerializer(serializers.ModelSerializer):
    def validate_status(self, value):
        allowed = {
            ScanOrder.Status.IN_PROGRESS,
            ScanOrder.Status.COMPLETED,
            ScanOrder.Status.CANCELLED,
        }
        if value not in allowed:
            raise serializers.ValidationError("Invalid status for scan order.")

        request = self.context.get("request")
        if (
            value == ScanOrder.Status.CANCELLED
            and request
            and getattr(request.user, "role", None) != "RECEPTIONIST"
        ):
            raise serializers.ValidationError("Only receptionist accounts can cancel orders.")

        return value

    class Meta:
        model = ScanOrder
        fields = '__all__'


class ScanResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScanResult
        fields = '__all__'
