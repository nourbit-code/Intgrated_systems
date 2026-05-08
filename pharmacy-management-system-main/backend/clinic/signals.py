from django.db.backends.signals import connection_created
from django.db.models.signals import post_save
from django.dispatch import receiver

from clinic.models import Prescription
from pharmacy.models import PharmacyOrder


@receiver(connection_created)
def tune_sqlite_connection(sender, connection, **kwargs):
    if connection.vendor != 'sqlite':
        return
    with connection.cursor() as cursor:
        cursor.execute('PRAGMA journal_mode=WAL;')
        cursor.execute('PRAGMA busy_timeout=30000;')
        cursor.execute('PRAGMA synchronous=NORMAL;')


@receiver(post_save, sender=Prescription)
def create_pharmacy_order(sender, instance, created, **kwargs):
    if not created:
        return
    PharmacyOrder.objects.get_or_create(
        prescription=instance,
        defaults={
            'patient': instance.patient,
            'status': 'New',
        },
    )
