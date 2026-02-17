export default async function handler(req, res) {
  try {
    // Try to import the main app bundle
    const app = await import('./index.js');
    res.status(200).json({
      status: "loaded",
      hasDefault: typeof app.default === 'function',
      exports: Object.keys(app)
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      name: error.name
    });
  }
}
