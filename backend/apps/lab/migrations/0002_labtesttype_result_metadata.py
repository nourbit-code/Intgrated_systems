from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lab", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="labtesttype",
            name="reference_max",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name="labtesttype",
            name="reference_min",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name="labtesttype",
            name="reference_text",
            field=models.CharField(blank=True, max_length=120, null=True),
        ),
        migrations.AddField(
            model_name="labtesttype",
            name="result_unit",
            field=models.CharField(blank=True, max_length=40, null=True),
        ),
    ]
