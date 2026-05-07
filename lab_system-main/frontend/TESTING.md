# Frontend Testing

## Setup

```powershell
cd frontend
npm install
```

## Run

```powershell
npm test
npm run test:watch
npm run test:coverage
npm run e2e
```

## Current starter tests

1. `__tests__/api.test.ts`
   - API helper behavior
   - date formatting
2. `__tests__/auth-signature.test.ts`
   - profile signature formatting

## Next tests to add (high value)

1. Login screen:
   - empty credentials validation
   - API error shows correct message
   - successful login routes correctly
2. User profile editor:
   - save sends correct payload
   - photo upload sets profile image value
   - success and error feedback states
3. Role-specific navigation visibility
4. Report filters and result rendering

## E2E (Playwright)

Flow file:

1. `e2e/labtech-and-receptionist-flow.spec.ts`

Validated flows:

1. Receptionist creates patient and sends order to lab queue (with backend persistence check)
2. LAB_TECH (`lab-tech` role in this system) logs in and sees persisted profile photo

Setup notes:

1. Keep backend running on `http://127.0.0.1:8000`
2. Install browsers once: `npx playwright install`

