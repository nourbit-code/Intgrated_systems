from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("patients", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="patient",
            name="insurance_expiry",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="patient",
            name="insurance_member_id",
            field=models.CharField(blank=True, max_length=120, null=True),
        ),
        migrations.AddField(
            model_name="patient",
            name="insurance_policy_number",
            field=models.CharField(blank=True, max_length=120, null=True),
        ),
        migrations.AddField(
            model_name="patient",
            name="insurance_provider",
            field=models.CharField(blank=True, max_length=120, null=True),
        ),
    ]
