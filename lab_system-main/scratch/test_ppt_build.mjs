const artifact = await import('file:///C:/Users/nours/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs');
const { Presentation, PresentationFile, column, text, fill, hug, fixed, rule } = artifact;

const p = await Presentation.create({ slideSize: { width: 1920, height: 1080 } });
const s = p.slides.add();
s.compose(
  column({ name:'root', width: fill, height: fill, padding: 80, gap: 20 }, [
    text('AlphaLab Presentation', { name:'title', width: fill, height: hug, style: { fontSize: 64, bold: true, color: '#0F172A' } }),
    rule({ name:'r', width: fixed(320), stroke: '#0B6E4F', weight: 4 }),
    text('Quick test export', { name:'sub', width: fill, height: hug, style: { fontSize: 32, color: '#334155' } })
  ]),
  { frame: { left:0, top:0, width:1920, height:1080 }, baseUnit: 8 }
);
const blob = await PresentationFile.exportPptx(p);
await blob.save('output/test_artifact_tool.pptx');
console.log('saved');
