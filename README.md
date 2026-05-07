# Intgrated_systems

Minimal integration flow between:
- Dermatology clinic system
- Lab system
- Pharmacy system

## What is implemented

`integration.py` provides an `IntegratedCareCoordinator` that:
1. Creates a dermatology visit record
2. Creates lab orders when tests are requested
3. Creates a pharmacy prescription when medications are prescribed
4. Returns a single integrated response payload

## Run tests

```bash
python -m unittest discover -s tests -v
```
