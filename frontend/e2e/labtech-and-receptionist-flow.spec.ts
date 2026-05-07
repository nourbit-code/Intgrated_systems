import { expect, test, type Page } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:8000';
const RECEPTIONIST_EMAIL = process.env.E2E_RECEPTIONIST_EMAIL ?? 'reception@example.com';
const RECEPTIONIST_PASSWORD = process.env.E2E_RECEPTIONIST_PASSWORD ?? 'ChangeMe123!';

type ApiUser = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
};

async function login(
  page: Page,
  input: {
    email: string;
    password: string;
    roleLabel: 'Receptionist' | 'Lab Technician';
    expectedPath: RegExp;
  }
) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(input.email);
  await page.getByLabel('Password').fill(input.password);
  await page.getByText(input.roleLabel, { exact: true }).click();
  await page.getByText(/sign in/i).first().click();
  await expect(page).toHaveURL(input.expectedPath);
}

test.describe.serial('E2E Critical Flows', () => {
  test('Receptionist can create patient and send order to lab queue (DB persisted)', async ({ page, request }) => {
    const suffix = Date.now();
    const patientName = `E2E Patient ${suffix}`;
    const phone = `010${String(suffix).slice(-8)}`;

    const beforeAppointmentsResponse = await request.get(`${API_BASE_URL}/api/v1/appointments/`);
    expect(beforeAppointmentsResponse.ok()).toBeTruthy();
    const beforeAppointments = (await beforeAppointmentsResponse.json()) as Array<unknown>;

    await login(page, {
      email: RECEPTIONIST_EMAIL,
      password: RECEPTIONIST_PASSWORD,
      roleLabel: 'Receptionist',
      expectedPath: /\/receptionist/,
    });

    await page.getByText('Add Patient', { exact: true }).first().click();
    await page.getByLabel('Full Name *').fill(patientName);
    await page.getByLabel('Age *').fill('31');
    await page.getByLabel('Phone *').fill(phone);
    await page.getByText('Register Patient', { exact: true }).first().click();

    await expect(page).toHaveURL(/\/patients/);
    await expect(page.getByText(patientName)).toBeVisible();

    await page.getByPlaceholder('Search patients...').fill(patientName);
    await page.getByText(patientName).first().click();
    await page.getByText('Create Order', { exact: true }).last().click();

    await expect(page).toHaveURL(/\/receptionist\/create-order/);
    await page.getByText('Blood Glucose').first().click();
    await page.getByText('Send request to the Lab', { exact: true }).first().click();
    await expect(page.getByText('Request sent successfully')).toBeVisible();

    await expect
      .poll(async () => {
        const response = await request.get(`${API_BASE_URL}/api/v1/appointments/`);
        if (!response.ok()) return -1;
        const appointments = (await response.json()) as Array<unknown>;
        return appointments.length;
      })
      .toBeGreaterThan(beforeAppointments.length);
  });

  test('Lab-tech user profile photo persists and appears after login', async ({ page, request }) => {
    const suffix = Date.now();
    const username = `e2e_labtech_${suffix}`;
    const email = `e2e_labtech_${suffix}@example.com`;
    const password = 'ChangeMe123!';
    const photoDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

    const createResponse = await request.post(`${API_BASE_URL}/api/v1/users/`, {
      data: {
        username,
        email,
        first_name: 'E2E',
        last_name: 'LabTech',
        role: 'LAB_TECH',
        password,
        photo_data_url: photoDataUrl,
        is_active: true,
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as ApiUser;

    const verifyResponse = await request.get(`${API_BASE_URL}/api/v1/users/${created.id}/`);
    expect(verifyResponse.ok()).toBeTruthy();
    const verifyBody = (await verifyResponse.json()) as { photo_data_url?: string };
    expect(verifyBody.photo_data_url).toBe(photoDataUrl);

    await login(page, {
      email,
      password,
      roleLabel: 'Lab Technician',
      expectedPath: /\/lab-tech/,
    });

    await page.goto('/lab-tech/profile');
    await expect(page.getByText('My Profile')).toBeVisible();
    await expect(page.getByText('E2E LabTech')).toBeVisible();
    await expect(page.getByTestId('profile-photo')).toBeVisible();
  });
});
