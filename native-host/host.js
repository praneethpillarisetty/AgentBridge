#!/usr/bin/env node

function readMessage() {
  return new Promise((resolve, reject) => {
    const chunks = [];

    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) chunks.push(chunk);
    });

    process.stdin.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 4) return resolve(null);
        const length = buffer.readUInt32LE(0);
        const body = buffer.subarray(4, 4 + length).toString('utf8');
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    process.stdin.on('error', reject);
  });
}

function sendMessage(message) {
  const encoded = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(encoded.length, 0);
  process.stdout.write(Buffer.concat([header, encoded]));
}

async function run() {
  try {
    const incoming = await readMessage();
    if (!incoming) return;
    console.error('[native-host] received', JSON.stringify(incoming));
    sendMessage({ ok: true, receivedAt: new Date().toISOString(), echo: incoming });
  } catch (error) {
    sendMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

run();
