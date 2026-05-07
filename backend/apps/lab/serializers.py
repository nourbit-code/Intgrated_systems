from rest_framework import serializers

from .models import LabResult, LabTestOrder, LabTestType


class LabTestTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabTestType
        fields = '__all__'


class LabTestOrderSerializer(serializers.ModelSerializer):
    def validate_status(self, value):
        allowed = {
            LabTestOrder.Status.WAITING_FOR_SAMPLE,
            LabTestOrder.Status.IN_PROGRESS,
            LabTestOrder.Status.COMPLETED,
            LabTestOrder.Status.CANCELLED,
        }
        if value not in allowed:
            raise serializers.ValidationError("Invalid status for lab test order.")

        request = self.context.get("request")
        if (
            value == LabTestOrder.Status.CANCELLED
            and request
            and getattr(request.user, "role", None) != "RECEPTIONIST"
        ):
            raise serializers.ValidationError("Only receptionist accounts can cancel orders.")

        return value

    class Meta:
        model = LabTestOrder
        fields = '__all__'


class LabResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabResult
        fields = '__all__'
