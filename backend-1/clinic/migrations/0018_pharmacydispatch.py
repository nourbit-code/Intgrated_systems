from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('clinic', '0017_patientfile_fhir_tracking'),
    ]

    operations = [
        migrations.CreateModel(
            name='PharmacyDispatch',
            fields=[
                ('dispatch_id', models.AutoField(primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('queued', 'Queued'), ('sent', 'Sent'), ('acknowledged', 'Acknowledged'), ('failed', 'Failed')], default='queued', max_length=20)),
                ('idempotency_key', models.CharField(max_length=255, unique=True)),
                ('external_request_id', models.CharField(blank=True, max_length=255)),
                ('fhir_payload', models.JSONField(blank=True, default=dict)),
                ('response_payload', models.JSONField(blank=True, default=dict)),
                ('retry_count', models.PositiveIntegerField(default=0)),
                ('last_error', models.TextField(blank=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('acknowledged_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('prescription', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pharmacy_dispatches', to='clinic.prescription')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
