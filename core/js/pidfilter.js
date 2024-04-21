"use strict";

const modFs = require("fs");

const filterForPid = process.argv[2];

const buf = Buffer.alloc(188);
while (true)
{
    const size = modFs.readSync(0, buf, 0, 188);

    if (size < 188) break;

    const bytes = (buf[1] << 8) + buf[2];
    const pid = bytes & 0b1111111111111;

    if (filterForPid !== pid) continue;

    process.stdout.write(buf.toString("binary"));
}
