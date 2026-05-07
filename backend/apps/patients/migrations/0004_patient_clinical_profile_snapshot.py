from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("patients", "0003_rename_primary_doctor_to_primary_lab_tech"),
    ]

    operations = [
        migrations.AddField(
            model_name="patient",
            name="clinical_profile_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
