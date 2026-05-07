from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Patient


class PatientSerializer(serializers.ModelSerializer):
    primary_doctor = serializers.PrimaryKeyRelatedField(
        source="primary_lab_tech",
        queryset=get_user_model().objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Patient
        fields = '__all__'

