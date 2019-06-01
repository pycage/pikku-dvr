"use strict";

const modFs = require("fs"),
      modPath = require("path"),
      modProcess = require("process");

const modEit = require("./eitparser.js");


var epgPath = modProcess.argv[2];
if (! epgPath)
{
    console.error("Usage: node epg-weaver.js <EPG path>");
    process.exit(1);
}

var epgFile = modPath.join(epgPath, "epg.json");
var epg = modFs.existsSync(epgFile) ? JSON.parse(modFs.readFileSync(epgFile))
                                    : { };
var now = new Date().getTime() / 1000;

modFs.readdirSync(epgPath).forEach(function (file)
{
    if (! file.endsWith(".eit"))
    {
        return;
    }
    
    //console.log("Collecting EIT data from " + file + ".");
    var eit = new modEit.EITParser().parse(modFs.readFileSync(modPath.join(epgPath, file)));

    for (var ts in eit)
    {
        for (var service in eit[ts])
        {
            if (! epg[service])
            {
                epg[service] = { };
            }
            for (var table in eit[ts][service])
            {
                if (! epg[service][table])
                {
                    epg[service][table] = { };
                }

                for (var event in eit[ts][service][table])
                {
                    epg[service][table][event] = eit[ts][service][table][event];
                }

                // remove outdated events from this table
                for (event in epg[service][table])
                {
                    var evObj = epg[service][table][event];
                    if (evObj)
                    {
                        var evEnd = evObj.start + evObj.duration;
                        if (evEnd <= now)
                        {
                            delete epg[service][table][event];
                        }
                    }
                }
            }
        }
    }
});

var servicesAmount = 0;
var eventsAmount = 0;
for (var service in epg)
{
    ++servicesAmount;

    for (var table in epg[service])
    {
        for (var event in epg[service][table])
        {
            ++eventsAmount;
        }
    }
}
console.log("Found " + eventsAmount + " events in " + servicesAmount + " channels.");
modFs.writeFileSync(epgFile + ".partial", JSON.stringify(epg, " ", 4));
modFs.renameSync(epgFile + ".partial", epgFile);
