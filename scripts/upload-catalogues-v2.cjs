/**
 * v2 – reanalyzed sessions, each distinct photo session gets its own catalogue.
 * Deletes the 5 incorrect catalogues created by v1, then creates 17 correct ones.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');
const { Client } = require('pg');

// ── Config ────────────────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME = 'dl36o1oyd';
const CLOUDINARY_API_KEY    = '656936825747644';
const CLOUDINARY_API_SECRET = 'XUZ32POTKWXtpmu_cw6rbWH4XgQ';
const DATABASE_URL = 'postgresql://neondb_owner:npg_6KDx1FbknfzB@ep-empty-river-aiom5anz-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const SOURCE_DIR   = '/Volumes/Untitled/zip';
const CLOUDINARY_FOLDER = 'catalogues';
const CHECKPOINT_FILE = path.join(__dirname, 'upload-v2-checkpoint.json');

// ── Sessions (each = one catalogue) ──────────────────────────────────────────
// Files listed by basename; all live in SOURCE_DIR.
const SESSIONS = [
  {
    title: 'Sunset Beach – Blue Dress',
    description: 'An elegant sunset beach portrait session featuring a stunning blue dress against the vibrant Caribbean sky.',
    serviceType: 'photoshoot',
    files: ['_ATC0019.jpg','_ATC0029.jpg','_ATC0032.jpg','_ATC0052.jpg','_ATC9994.jpg'],
  },
  {
    title: 'White Dress Portraits',
    description: 'Graceful portrait sessions in flowing white dresses, captured at golden hour on the beach and resort grounds.',
    serviceType: 'photoshoot',
    files: ['_ATC0071.jpg','_ATC0072.jpg','_ATC9965.jpg','_ATC9967.jpg','_ATC9980.jpg'],
  },
  {
    title: 'Night Out – Red Tie-Dye',
    description: 'A vibrant nighttime lifestyle shoot at a popular waterfront venue, capturing the energy of a Caribbean night out.',
    serviceType: 'photoshoot',
    files: ['_ATC0164.jpg','_ATC0194.jpg','_ATC0196.jpg','_ATC0223.jpg','_ATC0231.jpg','_ATC0232.jpg'],
  },
  {
    title: 'Night Beach & Resort – Bikini Sessions',
    description: 'Sultry nighttime beach and poolside portrait sessions under the stars at a Caribbean resort.',
    serviceType: 'photoshoot',
    files: ['_ATC0299.jpg','_ATC0327.jpg','_ATC0348.jpg'],
  },
  {
    title: 'Gold Gown – Night Garden',
    description: 'A glamorous nighttime session in a lush tropical resort garden, featuring a stunning gold metallic gown.',
    serviceType: 'photoshoot',
    files: ['_ATC0450.jpg','_ATC0468.jpg','_ATC0472.jpg','_ATC0474.jpg','_ATC0484.jpg','_ATC0485.jpg'],
  },
  {
    title: "Men's Fashion Portraits",
    description: "Sharp and confident men's fashion portraits shot at various iconic Caribbean locations.",
    serviceType: 'photoshoot',
    files: ['_ATC0558.jpg','_ATC0591.jpg','_ATC0593.jpg','_ATC0612.jpg','_ATC0621.jpg','_ATC0627.jpg','_ATC4604.jpg'],
  },
  {
    title: 'Animal Print Swimsuit – Sunset Garden',
    description: 'A bold and artistic swimwear session in a tropical garden at golden hour, featuring a stunning animal print cutout swimsuit.',
    serviceType: 'photoshoot',
    files: ['_ATC0657.jpg','_ATC0660.jpg','_ATC0665.jpg','_ATC0674.jpg','_ATC0682.jpg','_ATC0694.jpg','1_ATC0682.jpg'],
  },
  {
    title: 'Floral Beach Session',
    description: 'A colorful daytime beach portrait session featuring vibrant floral attire against the backdrop of the Caribbean sea.',
    serviceType: 'photoshoot',
    files: ['_ATC1154.jpg','_ATC1157.jpg','_ATC1160.jpg','_ATC1203.jpg','_ATC1289.jpg','_ATC1292.jpg','_ATC1296.jpg','_ATC1300.jpg','_ATC1327.jpg','_ATC1332.jpg'],
  },
  {
    title: 'Couple Portraits – Outdoor Session',
    description: 'A romantic outdoor couples portrait session capturing love and connection at beautiful Caribbean locations.',
    serviceType: 'photoshoot',
    files: ['_ATC7850.jpg','_ATC7853.jpg','_ATC7856.jpg','_ATC7875.jpg','_ATC7878.jpg','_ATC7908.jpg','_ATC7986.jpg','_ATC7992 1.jpg','_ATC7993 1.jpg','_ATC8022 1.jpg','_ATC8034 1.jpg','_ATC8042 1.jpg','_ATC8048 1.jpg','_ATC8049 1.jpg','_ATC8080 1.jpg','_ATC8088 1.jpg'],
  },
  {
    title: 'Studio & Boudoir Portraits',
    description: 'Elegant and intimate studio portrait sessions showcasing confidence, glamour, and natural beauty.',
    serviceType: 'photoshoot',
    files: ['_ATC0356 1.jpg','_ATC0364 1.jpg','_ATC0422 1.jpg','_ATC0427 1.jpg','_ATC8692 1.jpg'],
  },
  {
    title: 'Maternity Session',
    description: 'A beautiful maternity portrait session celebrating the miracle of new life, captured at a serene Caribbean waterfront.',
    serviceType: 'photoshoot',
    files: ['_ATC8348.jpg'],
  },
  {
    title: 'Event Photography – Club Portraits',
    description: 'High-energy event and nightclub portrait photography, capturing individuals at their most vibrant and stylish.',
    serviceType: 'photoshoot',
    files: ['_ATC9732.jpg','_ATC9746.jpg','_ATC9748.jpg','_ATC9788.jpg','_ATC9793.jpg','_ATC9814.jpg'],
  },
  {
    title: 'Cove Beach – Swimwear Session',
    description: 'A confident swimwear portrait session at a private cove beach with crystal-clear turquoise waters.',
    serviceType: 'photoshoot',
    files: ['_ATC9883.jpg','_ATC9884.jpg','_ATC9886.jpg'],
  },
  {
    title: 'Beach Swimwear – Animal Print',
    description: 'A bold and expressive swimwear beach session featuring eye-catching animal print against the Caribbean coastline.',
    serviceType: 'photoshoot',
    files: ['_ATC9886 1.jpg','_ATC9893 1.jpg','_ATC9898 1.jpg'],
  },
  {
    title: 'Night Beach – White Satin',
    description: 'A dreamy and romantic nighttime beach session, with flowing white satin and the gentle Caribbean waves.',
    serviceType: 'photoshoot',
    files: ['_ATC9216 2.jpg','_ATC9224 2.jpg','_ATC9233 2.jpg','_ATC9243 2.jpg','_ATC9263 2.jpg','_ATC9956 2.jpg'],
  },
  {
    title: 'Family Beach Portraits',
    description: 'Precious family memories captured on a beautiful Caribbean beach with turquoise waters and white sand.',
    serviceType: 'photoshoot',
    files: ['_ATC9537 3.jpg','_ATC9548 3.jpg','_ATC9554 3.jpg','_ATC9556 3.jpg','_ATC9574 3.jpg','_ATC9618 3.jpg','_ATC9643 3.jpg','_ATC9651 3.jpg','_ATC9658 3.jpg','_ATC9690 3.jpg','_ATC9698 3.jpg','_ATC9701 3.jpg','_ATC9716 3.jpg','_ATC9756 3.jpg'],
  },
  {
    title: 'Couples Beach Cabana',
    description: 'A romantic and joyful couples session at a stunning white beach cabana, filled with love and laughter.',
    serviceType: 'photoshoot',
    files: ['_ATC9768 4.jpg','_ATC9795 4.jpg','_ATC9818 4.jpg','_ATC9824 4.jpg','_ATC9863 4.jpg','_ATC9864 4.jpg','_ATC9882 4.jpg','_ATC9913 4.jpg','_ATC9939 4.jpg','_ATC9947 4.jpg','_ATC9972 4.jpg','_ATC9973 4.jpg'],
  },
];

// Verify total = 115
const total = SESSIONS.reduce((s, g) => s + g.files.length, 0);
console.log(`Defined ${SESSIONS.length} sessions covering ${total} files.\n`);

// ── Helpers ───────────────────────────────────────────────────────────────────
const MAX_BYTES = 9 * 1024 * 1024;

function maybeCompress(filePath) {
  const size = fs.statSync(filePath).size;
  if (size <= MAX_BYTES) return { path: filePath, temp: false };
  const tmpPath = path.join(os.tmpdir(), `cld_${Date.now()}_${path.basename(filePath)}`);
  execSync(`sips -Z 2800 --setProperty formatOptions 82 "${filePath}" --out "${tmpPath}"`, { stdio: 'pipe' });
  return { path: tmpPath, temp: true };
}

async function uploadToCloudinary(originalPath) {
  const { path: filePath, temp } = maybeCompress(originalPath);
  try {
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = `folder=${CLOUDINARY_FOLDER}&timestamp=${timestamp}`;
    const signature = crypto.createHash('sha1').update(paramsToSign + CLOUDINARY_API_SECRET).digest('hex');
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
    const form = new FormData();
    form.append('file', blob, path.basename(originalPath));
    form.append('api_key', CLOUDINARY_API_KEY);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);
    form.append('folder', CLOUDINARY_FOLDER);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
    if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status}: ${t}`); }
    return (await res.json()).secure_url;
  } finally {
    if (temp) fs.unlinkSync(filePath);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Load checkpoint
  let checkpoint = {};
  if (fs.existsSync(CHECKPOINT_FILE)) {
    checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    const done = Object.keys(checkpoint).length;
    console.log(`Resuming — ${done} sessions already uploaded.\n`);
  }

  // ── Phase 1: Upload all images ────────────────────────────────────────────
  for (const session of SESSIONS) {
    if (checkpoint[session.title]) {
      console.log(`━ "${session.title}" — already uploaded (${checkpoint[session.title].urls.length} images), skipping.`);
      continue;
    }

    console.log(`\n━━━ "${session.title}" (${session.files.length} images) ━━━`);
    const urls = [];

    for (let i = 0; i < session.files.length; i++) {
      const basename = session.files[i];
      const filePath = path.join(SOURCE_DIR, basename);
      if (!fs.existsSync(filePath)) {
        console.log(`  [${i+1}/${session.files.length}] ${basename} — FILE NOT FOUND, skipping`);
        continue;
      }
      process.stdout.write(`  [${i+1}/${session.files.length}] ${basename} … `);
      try {
        urls.push(await uploadToCloudinary(filePath));
        console.log('✓');
      } catch (err) {
        console.log(`✗ ${err.message}`);
      }
    }

    checkpoint[session.title] = { urls };
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
    console.log(`  → Saved ${urls.length} URLs.`);
  }

  console.log('\n─── All uploads done. Connecting to DB… ───\n');

  // ── Phase 2: DB operations ────────────────────────────────────────────────
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // Delete the 5 old wrong catalogues by title
  const oldTitles = [
    'Sunset Beach Photoshoot',
    'Studio Boudoir Session',
    'Night Beach Session',
    'Family Beach Portraits',
    'Couples Beach Session',
  ];
  const del = await db.query(
    `DELETE FROM catalogues WHERE title = ANY($1) RETURNING title`,
    [oldTitles]
  );
  console.log(`Deleted ${del.rowCount} old catalogue(s): ${del.rows.map(r => r.title).join(', ')}\n`);

  // Insert new catalogues
  for (const session of SESSIONS) {
    const cp = checkpoint[session.title];
    if (!cp || cp.urls.length === 0) {
      console.log(`  SKIP "${session.title}" — no uploaded images.`);
      continue;
    }
    const now = new Date().toISOString();
    const result = await db.query(
      `INSERT INTO catalogues
         (id, title, description, service_type, cover_image, images,
          is_published, sort_order, published_at, created_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,true,0,$6,$6)
       RETURNING id`,
      [session.title, session.description, session.serviceType, cp.urls[0], cp.urls, now]
    );
    console.log(`✓ Created "${session.title}" — ${cp.urls.length} images (id=${result.rows[0].id})`);
  }

  await db.end();
  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
  console.log('\nDone! Checkpoint deleted.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
