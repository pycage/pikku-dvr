"use strict";

const modFs = require("fs");

var filterForPid = process.argv[2];

var buf = Buffer.alloc(188);
while (true)
{
    var size = modFs.readSync(0, buf, 0, 188);

    if (size < 188) break;

    var bytes = (buf[1] << 8) + buf[2];
    var pid = bytes & 0b1111111111111;

    if (filterForPid !== pid) continue;

    process.stdout.write(buf.toString("binary"));
}
