import unittest

from integration import (
    DermatologyClinicSystem,
    IntegratedCareCoordinator,
    LabSystem,
    PharmacySystem,
)


class IntegratedCareCoordinatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.coordinator = IntegratedCareCoordinator(
            clinic=DermatologyClinicSystem(),
            lab=LabSystem(),
            pharmacy=PharmacySystem(),
        )

    def test_routes_case_to_lab_and_pharmacy(self) -> None:
        result = self.coordinator.process_case(
            patient_id="P-001",
            diagnosis="Suspected fungal infection",
            lab_tests=["KOH", "Culture"],
            medications=["Topical antifungal"],
        )

        self.assertEqual(result["visit"]["patient_id"], "P-001")
        self.assertEqual(len(result["lab_orders"]), 2)
        self.assertEqual(result["lab_orders"][0]["test"], "KOH")
        self.assertEqual(result["prescription"]["medications"], ["Topical antifungal"])

    def test_skips_optional_flows_when_not_requested(self) -> None:
        result = self.coordinator.process_case(
            patient_id="P-002",
            diagnosis="Contact dermatitis",
        )

        self.assertEqual(result["lab_orders"], [])
        self.assertIsNone(result["prescription"])


if __name__ == "__main__":
    unittest.main()
