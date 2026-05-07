const artifact = await import('file:///C:/Users/nours/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs');
const { Presentation, PresentationFile, column, row, text, image, rule, fill, hug, fixed, wrap, fr } = artifact;

const WIDTH = 1920;
const HEIGHT = 1080;
const colors = {
  bg: '#F4F8FC', ink: '#0F172A', muted: '#475569', accent: '#0B6E4F', dark: '#0B1324'
};

const logoPath = 'frontend/assets/images/icon.png';
const ss1 = 'scratch/screenshots/t1_view.png';
const ss2 = 'scratch/screenshots/t2_view.png';

const p = await Presentation.create({ title: 'AlphaLab System Discussion', slideSize: { width: WIDTH, height: HEIGHT } });

function frame(slide, title, bodyLines) {
  slide.compose(
    column({ name: 'root', width: fill, height: fill, padding: { x: 90, y: 60 }, gap: 18 }, [
      text(title, { name: 'title', width: fill, height: hug, style: { fontSize: 56, bold: true, color: colors.ink } }),
      rule({ name: 'line', width: fixed(300), stroke: colors.accent, weight: 4 }),
      text(bodyLines.join('\n'), { name: 'body', width: wrap(1700), height: hug, style: { fontSize: 30, color: colors.muted } }),
    ]),
    { frame: { left: 0, top: 0, width: WIDTH, height: HEIGHT }, baseUnit: 8 }
  );
}

// Slide 1
{
  const s = p.slides.add();
  s.compose(
    row({ name: 'root', width: fill, height: fill, padding: { x: 90, y: 80 }, gap: 36 }, [
      image({ name: 'logo', path: logoPath, width: fixed(170), height: fixed(170), fit: 'contain' }),
      column({ name: 'stack', width: fill, height: fill, gap: 14 }, [
        text('AlphaLab System', { name: 'title', width: fill, height: hug, style: { fontSize: 78, bold: true, color: colors.dark } }),
        text('Integrated Laboratory, Radiology, Inventory, Billing, and Reporting Platform', { name: 'sub', width: wrap(1500), height: hug, style: { fontSize: 31, color: colors.muted } }),
        rule({ name: 'line', width: fixed(420), stroke: colors.accent, weight: 5 }),
        text('Discussion Deck | 2026', { name: 'meta', width: fill, height: hug, style: { fontSize: 24, color: colors.accent } }),
        text('One connected workflow from patient registration to final result, payment, and analytics.', { name: 'p', width: wrap(1450), height: hug, style: { fontSize: 34, color: colors.ink } }),
      ]),
    ]),
    { frame: { left: 0, top: 0, width: WIDTH, height: HEIGHT }, baseUnit: 8 }
  );
}

// Slide 2
frame(p.slides.add(), 'Agenda', [
  '1. System Vision and Value',
  '2. Technical Architecture',
  '3. Operational Workflow by Role',
  '4. Core Modules and Differentiators',
  '5. Screenshots (Radiology Sample Views)',
  '6. Security and Integration Readiness',
  '7. Next Steps',
]);

// Slide 3
frame(p.slides.add(), 'Technical Architecture', [
  '• Frontend: React Native + Expo + Expo Router',
  '• Backend: Django + DRF REST APIs',
  '• Data: SQLite (current setup), migration-ready design',
  '• Security: Session auth + CSRF + role-based permissions',
  '• Quality: backend tests, API smoke tests, frontend unit tests, Playwright E2E',
]);

// Slide 4
frame(p.slides.add(), 'End-to-End Workflow', [
  '• Reception registers patient and insurance details',
  '• Order is created (lab tests or scans) and linked to appointment/invoice',
  '• Sample collection or radiology upload is performed by technician',
  '• Result entry applies validation and critical-range checks',
  '• Billing, payment, and report analytics complete the cycle',
]);

// Slide 5
frame(p.slides.add(), 'Role-Based Operational Coverage', [
  'Receptionist:',
  '• Add patient, create orders, billing, insurance settings, user management, reports',
  '',
  'Lab Technician:',
  '• Worklist dashboard, sample collection, test run, result entry, radiology reporting, inventory operations',
]);

// Slide 6 Screenshot
{
  const s = p.slides.add();
  s.compose(
    column({ name: 'root', width: fill, height: fill, padding: { x: 80, y: 50 }, gap: 14 }, [
      text('System Screenshot 1: Radiology Sample View', { name: 'title', width: fill, height: hug, style: { fontSize: 52, bold: true, color: colors.ink } }),
      rule({ name: 'line', width: fixed(360), stroke: colors.accent, weight: 4 }),
      image({ name: 'ss1', path: ss1, width: fill, height: fixed(780), fit: 'contain', alt: 'Radiology sample screenshot' }),
      text('Captured visual from system imaging assets used in radiology workflow.', { name: 'note', width: fill, height: hug, style: { fontSize: 23, color: colors.muted } }),
    ]),
    { frame: { left: 0, top: 0, width: WIDTH, height: HEIGHT }, baseUnit: 8 }
  );
}

// Slide 7 Screenshot
{
  const s = p.slides.add();
  s.compose(
    column({ name: 'root', width: fill, height: fill, padding: { x: 80, y: 50 }, gap: 14 }, [
      text('System Screenshot 2: Radiology Sample View', { name: 'title', width: fill, height: hug, style: { fontSize: 52, bold: true, color: colors.ink } }),
      rule({ name: 'line', width: fixed(360), stroke: colors.accent, weight: 4 }),
      image({ name: 'ss2', path: ss2, width: fill, height: fixed(780), fit: 'contain', alt: 'Radiology sample screenshot 2' }),
      text('Second imaging sample representing DICOM-oriented radiology context.', { name: 'note', width: fill, height: hug, style: { fontSize: 23, color: colors.muted } }),
    ]),
    { frame: { left: 0, top: 0, width: WIDTH, height: HEIGHT }, baseUnit: 8 }
  );
}

// Slide 8
frame(p.slides.add(), 'Core Modules and Differentiators', [
  '• Patient Directory + EMR timeline views',
  '• Barcode-enabled sample handling',
  '• Multi-parameter lab result entry with critical alerts',
  '• DICOM-capable radiology reporting workflow',
  '• Inventory alerts, transaction logs, supplier and purchase order flow',
  '• Billing + insurance discount logic + financial reports',
]);

// Slide 9
frame(p.slides.add(), 'Integration Readiness (Two External Systems)', [
  'Available now:',
  '• Unified REST API endpoints under /api/v1',
  '• Strict validation and unique IDs',
  '• Activity logging and reporting endpoints',
  '',
  'Recommended before integration go-live:',
  '• Machine-to-machine auth token model',
  '• Idempotency keys + external ID mapping',
  '• Webhook/event layer and reconciliation jobs',
]);

// Slide 10
frame(p.slides.add(), 'Next Steps for Discussion', [
  '1) Confirm integration ownership and source-of-truth rules',
  '2) Approve field-level mapping with System A and System B',
  '3) Pilot with one workflow (orders + results)',
  '4) Extend to billing/inventory sync and production rollout',
  '',
  'Prepared files: SYSTEM_SALES_DESCRIPTION.md and INTEGRATION_SPEC.md',
]);

const out = 'output/AlphaLab_System_Discussion.pptx';
const blob = await PresentationFile.exportPptx(p);
await blob.save(out);
console.log(`saved ${out}`);
