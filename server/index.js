require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

const app = require('./src');
const connectDB = require('./src/config/db');
const mongoose = require('mongoose');

async function main() {
  const port = process.env.PORT || 4000;
  
  const host = process.env.HOST || '127.0.0.1';

  await connectDB();
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required in server/.env');
  await require('./src/models/notification').init();
  await require('./src/models/defenceNotice').init();
  await require('./src/models/department').init();
  await require('./src/models/supervisor').init();
  await require('./src/models/student').init();
  await require('./src/models/examiner').init();
  await require('./src/models/workspace').init();
  await require('./src/models/chatPage').init();
  await require('./src/models/chatRead').init();
  await require('./src/models/supervisionLedger').init();

  const server = app.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}`);
  });

  server.on('error', async (error) => {
    console.error('Failed to start server:', error.message);
    process.exitCode = 1;
    await mongoose.disconnect();
  });
}

main().catch(async (error) => {
  console.error('Failed to bootstrap server:', error.message);
  process.exitCode = 1;
  await mongoose.disconnect();
});
