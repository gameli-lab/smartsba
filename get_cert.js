const tls = require('tls');
const options = {
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  rejectUnauthorized: false,
};
const socket = tls.connect(options, () => {
  const cert = socket.getPeerCertificate();
  console.log('=== CERTIFICATE ===');
  console.log(JSON.stringify({
    subject: cert.subject,
    issuer: cert.issuer,
    raw: cert.raw.toString('base64'),
  }));
  socket.end();
});
socket.on('error', (err) => {
  console.error('TLS error:', err.message);
});
socket.on('data', (data) => {
  console.log('Received data:', data.length, 'bytes');
});
setTimeout(() => { console.error('Timeout'); process.exit(1); }, 10000);
