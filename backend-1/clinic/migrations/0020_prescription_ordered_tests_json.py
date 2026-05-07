from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clinic', '0019_patient_global_patient_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='prescription',
            name='ordered_tests_json',
            field=models.TextField(blank=True, default='[]'),
        ),
    ]

