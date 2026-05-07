from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("patients", "0002_patient_insurance_fields"),
    ]

    operations = [
        migrations.RenameField(
            model_name="patient",
            old_name="primary_doctor",
            new_name="primary_lab_tech",
        ),
    ]
