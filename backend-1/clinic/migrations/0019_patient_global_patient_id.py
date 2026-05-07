from django.db import migrations, models
import uuid


def backfill_global_patient_id(apps, schema_editor):
    Patient = apps.get_model("clinic", "Patient")
    for patient in Patient.objects.filter(global_patient_id__isnull=True).only("patient_id"):
        patient.global_patient_id = uuid.uuid4()
        patient.save(update_fields=["global_patient_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("clinic", "0018_pharmacydispatch"),
    ]

    operations = [
        migrations.AddField(
            model_name="patient",
            name="global_patient_id",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.RunPython(backfill_global_patient_id, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="patient",
            name="global_patient_id",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
