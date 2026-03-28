interface ZipEntry {
  name: string;
  content: Buffer;
}

const CRC_TABLE = (() => {
  const table: number[] = [];
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16LE(value: number): Buffer {
  const buf = Buffer.allocUnsafe(2);
  buf.writeUInt16LE(value, 0);
  return buf;
}

function writeUInt32LE(value: number): Buffer {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32LE(value >>> 0, 0);
  return buf;
}

export function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.name, 'utf8');
    const data = entry.content;
    const checksum = crc32(data);

    const localHeader = Buffer.concat([
      writeUInt32LE(0x04034b50),
      writeUInt16LE(20),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(checksum),
      writeUInt32LE(data.length),
      writeUInt32LE(data.length),
      writeUInt16LE(fileName.length),
      writeUInt16LE(0),
      fileName,
    ]);

    localParts.push(localHeader, data);

    const centralHeader = Buffer.concat([
      writeUInt32LE(0x02014b50),
      writeUInt16LE(20),
      writeUInt16LE(20),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(checksum),
      writeUInt32LE(data.length),
      writeUInt32LE(data.length),
      writeUInt16LE(fileName.length),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(0),
      writeUInt32LE(offset),
      fileName,
    ]);

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const centralOffset = offset;

  const end = Buffer.concat([
    writeUInt32LE(0x06054b50),
    writeUInt16LE(0),
    writeUInt16LE(0),
    writeUInt16LE(entries.length),
    writeUInt16LE(entries.length),
    writeUInt32LE(centralDirectory.length),
    writeUInt32LE(centralOffset),
    writeUInt16LE(0),
  ]);

  return Buffer.concat([...localParts, centralDirectory, end]);
}
