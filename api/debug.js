export default async function handler(req, res) {
  try {
    const app = await import('./index.cjs');
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
