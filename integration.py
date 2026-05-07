from dataclasses import dataclass, field
from typing import Dict, List
from uuid import uuid4


@dataclass
class DermatologyClinicSystem:
    visits: List[Dict[str, object]] = field(default_factory=list)

    def create_visit(self, patient_id: str, diagnosis: str) -> Dict[str, object]:
        visit = {
            "visit_id": str(uuid4()),
            "patient_id": patient_id,
            "diagnosis": diagnosis,
        }
        self.visits.append(visit)
        return visit


@dataclass
class LabSystem:
    orders: List[Dict[str, object]] = field(default_factory=list)

    def create_orders(self, patient_id: str, tests: List[str]) -> List[Dict[str, object]]:
        created = []
        for test_name in tests:
            order = {
                "order_id": str(uuid4()),
                "patient_id": patient_id,
                "test": test_name,
                "status": "ordered",
            }
            self.orders.append(order)
            created.append(order)
        return created


@dataclass
class PharmacySystem:
    prescriptions: List[Dict[str, object]] = field(default_factory=list)

    def create_prescription(self, patient_id: str, medications: List[str]) -> Dict[str, object]:
        prescription = {
            "prescription_id": str(uuid4()),
            "patient_id": patient_id,
            "medications": list(medications),
            "status": "created",
        }
        self.prescriptions.append(prescription)
        return prescription


@dataclass
class IntegratedCareCoordinator:
    clinic: DermatologyClinicSystem
    lab: LabSystem
    pharmacy: PharmacySystem

    def process_case(
        self,
        patient_id: str,
        diagnosis: str,
        lab_tests: List[str] | None = None,
        medications: List[str] | None = None,
    ) -> Dict[str, object]:
        visit = self.clinic.create_visit(patient_id=patient_id, diagnosis=diagnosis)
        lab_orders = self.lab.create_orders(patient_id=patient_id, tests=lab_tests or [])
        prescription = None
        if medications:
            prescription = self.pharmacy.create_prescription(
                patient_id=patient_id,
                medications=medications,
            )

        return {
            "visit": visit,
            "lab_orders": lab_orders,
            "prescription": prescription,
        }
