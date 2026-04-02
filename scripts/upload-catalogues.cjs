/**
 * Script to upload photos from /Volumes/Untitled/zip/ to Cloudinary
 * and create 5 catalogue entries in the production database.
 *
 * Strategy: upload all images first (with checkpoint file for resume),
 * then connect to DB only at the very end for a quick bulk insert.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');
const { Client } = require('pg');

// ── Config ───────────────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME = 'dl36o1oyd';
const CLOUDINARY_API_KEY    = '656936825747644';
const CLOUDINARY_API_SECRET = 'XUZ32POTKWXtpmu_cw6rbWH4XgQ';
const DATABASE_URL = 'postgresql://neondb_owner:npg_6KDx1FbknfzB@ep-empty-river-aiom5anz-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const SOURCE_DIR   = '/Volumes/Untitled/zip';
const CLOUDINARY_FOLDER = 'catalogues';
const CHECKPOINT_FILE = path.join(__dirname, 'upload-checkpoint.json');

// ── Group Definitions ─────────────────────────────────────────────────────────
const GROUPS = [
  {
    suffix: null,
    title: 'Sunset Beach Photoshoot',
    description: 'A breathtaking golden-hour photoshoot on the beach, showcasing vibrant Caribbean scenery and natural beauty.',
    serviceType: 'photoshoot',
  },
  {
    suffix: ' 1',
    title: 'Studio Boudoir Session',
    description: 'An elegant and intimate boudoir photography session captured in a clean white studio setting.',
    serviceType: 'photoshoot',
  },
  {
    suffix: ' 2',
    title: 'Night Beach Session',
    description: 'A magical nighttime beach photoshoot where ocean waves and moonlight create a dreamy, ethereal atmosphere.',
    serviceType: 'photoshoot',
  },
  {
    suffix: ' 3',
    title: 'Family Beach Portraits',
    description: 'Cherished family portraits on the Caribbean beach, with turquoise waters and white sands as the backdrop.',
    serviceType: 'photoshoot',
  },
  {
    suffix: ' 4',
    title: 'Couples Beach Session',
    description: 'A romantic couples photoshoot at a beach cabana, filled with love, laughter, and stunning scenery.',
    serviceType: 'photoshoot',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function getSuffix(filename) {
  const base = path.basename(filename, path.extname(filename));
  const m = base.match(/ ([1-4])$/);
  return m ? ` ${m[1]}` : null;
}

const MAX_BYTES = 9 * 1024 * 1024;

function maybeCompress(filePath) {
  const size = fs.statSync(filePath).size;
  if (size <= MAX_BYTES) return { path: filePath, temp: false };

  const tmpPath = path.join(os.tmpdir(), `cld_${Date.now()}_${path.basename(filePath)}`);
  execSync(
    `sips -Z 2800 --setProperty formatOptions 82 "${filePath}" --out "${tmpPath}"`,
    { stdio: 'pipe' }
  );
  return { path: tmpPath, temp: true };
}

async function uploadToCloudinary(originalPath) {
  const { path: filePath, temp } = maybeCompress(originalPath);

  try {
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = `folder=${CLOUDINARY_FOLDER}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash('sha1')
      .update(paramsToSign + CLOUDINARY_API_SECRET)
      .digest('hex');

    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: 'image/jpeg' });

    const form = new FormData();
    form.append('file', blob, path.basename(originalPath));
    form.append('api_key', CLOUDINARY_API_KEY);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);
    form.append('folder', CLOUDINARY_FOLDER);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: 'POST', body: form }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const data = await res.json();
    return data.secure_url;
  } finally {
    if (temp) fs.unlinkSync(filePath);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Load checkpoint (resume support)
  let checkpoint = {};
  if (fs.existsSync(CHECKPOINT_FILE)) {
    checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    console.log(`Resuming from checkpoint: ${Object.keys(checkpoint).length} groups already processed.\n`);
  }

  const allFiles = fs.readdirSync(SOURCE_DIR)
    .filter(f => !f.startsWith('._') && /\.(jpg|jpeg)$/i.test(f))
    .map(f => path.join(SOURCE_DIR, f));

  console.log(`Found ${allFiles.length} real images in ${SOURCE_DIR}\n`);

  const groups = GROUPS.map(g => ({
    ...g,
    files: allFiles.filter(f => getSuffix(f) === g.suffix),
  }));

  groups.forEach(g =>
    console.log(`  Group "${g.title}" (suffix=${JSON.stringify(g.suffix)}): ${g.files.length} files`)
  );
  console.log();

  // ── Phase 1: Upload all images (no DB connection) ─────────────────────────
  for (const group of groups) {
    if (checkpoint[group.title]) {
      console.log(`━━━ ${group.title} — ALREADY UPLOADED (${checkpoint[group.title].urls.length} images), skipping.\n`);
      continue;
    }

    console.log(`━━━ ${group.title} (${group.files.length} images) ━━━`);

    if (group.files.length === 0) {
      console.log('  No files — skipping.\n');
      checkpoint[group.title] = { urls: [], group };
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
      continue;
    }

    const urls = [];

    for (let i = 0; i < group.files.length; i++) {
      const filePath = group.files[i];
      const name = path.basename(filePath);
      process.stdout.write(`  [${i + 1}/${group.files.length}] ${name} … `);
      try {
        const url = await uploadToCloudinary(filePath);
        urls.push(url);
        console.log('✓');
      } catch (err) {
        console.log(`✗ ${err.message}`);
      }
    }

    checkpoint[group.title] = { urls, group: { ...group, files: undefined } };
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
    console.log(`  Saved ${urls.length} URLs to checkpoint.\n`);
  }

  console.log('\n─── All uploads done. Connecting to database… ───\n');

  // ── Phase 2: Create catalogue entries ────────────────────────────────────
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  console.log('Connected.\n');

  for (const group of groups) {
    const cp = checkpoint[group.title];
    if (!cp || cp.urls.length === 0) {
      console.log(`Skipping "${group.title}" — no uploaded images.`);
      continue;
    }

    const coverImage = cp.urls[0];
    const now = new Date().toISOString();

    const result = await db.query(
      `INSERT INTO catalogues
         (id, title, description, service_type, cover_image, images,
          is_published, sort_order, published_at, created_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4, $5, true, 0, $6, $6)
       RETURNING id`,
      [group.title, group.description, group.serviceType, coverImage, cp.urls, now]
    );

    console.log(`✓ Created catalogue "${group.title}" (id=${result.rows[0].id}) with ${cp.urls.length} images.`);
  }

  await db.end();

  // Clean up checkpoint
  fs.unlinkSync(CHECKPOINT_FILE);
  console.log('\nAll done! Checkpoint file deleted.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
