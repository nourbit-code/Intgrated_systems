from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('clinic', '0016_patient_insurance_validity'),
    ]

    operations = [
        migrations.AddField(
            model_name='patientfile',
            name='external_report_id',
            field=models.CharField(blank=True, db_index=True, max_length=255),
        ),
        migrations.AddField(
            model_name='patientfile',
            name='fhir_payload',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='patientfile',
            name='reviewed',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='patientfile',
            name='reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='patientfile',
            name='reviewed_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_files', to='clinic.doctor'),
        ),
        migrations.AddField(
            model_name='patientfile',
            name='source_system',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
