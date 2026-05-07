from django.db import migrations, models


def migrate_doctor_role_to_lab_tech(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(role="DOCTOR").update(role="LAB_TECH")


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_user_address_user_contact_email_user_contact_phone_and_more"),
    ]

    operations = [
        migrations.RunPython(migrate_doctor_role_to_lab_tech, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[("LAB_TECH", "Lab Tech"), ("RECEPTIONIST", "Receptionist")],
                default="RECEPTIONIST",
                max_length=20,
            ),
        ),
    ]
